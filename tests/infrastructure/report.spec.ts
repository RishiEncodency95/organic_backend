import { describe, expect, it } from 'vitest';
import { writeFileSync } from 'node:fs';
import { automatedSummary, buildFindings, overallRisk, resolvePeriod, validateNarrative, type ReportFacts, type ServerFacts, type DomainFacts } from '../../src/modules/infrastructure/core/report/report.model';
import { renderReportPdf } from '../../src/modules/infrastructure/core/report/report.pdf';

const NOW = new Date('2026-10-15T12:00:00.000Z');

const server = (o: Partial<ServerFacts> = {}): ServerFacts => ({
  id: 's1', name: 'vmi3611795', provider: 'contabo', plan: 'Cloud VPS 4', region: 'European Union', ipv4: '203.0.113.5', environment: 'PRODUCTION', client: null,
  providerStatus: 'running', suspended: false, monitoring: 'online', specs: { vcpu: 4, ramMb: 12288, storageGb: 300 }, os: 'Ubuntu 24.04', kernel: '6.8', uptimeDays: 9,
  metrics: {
    samples: 4000, coveragePct: 96, cpu: { avg: 31, p95: 52, max: 71 }, mem: { avg: 58, p95: 64, max: 70 }, disk: { max: 42, latest: 42 }, swapMax: 4, load1: { avg: 0.8, max: 2.1 }, netRxBps: 450000, netTxBps: 210000,
    series: Array.from({ length: 40 }, (_, i) => ({ t: NOW.getTime() - (40 - i) * 3600_000, cpu: i === 20 ? null : 30 + 10 * Math.sin(i / 4), mem: 58 + 3 * Math.sin(i / 7), disk: 41 + i / 40 })),
  },
  openAlerts: 0, alertsInPeriod: 0, nextDue: null,
  health: { overall: 'ok', confidence: 'medium', dimensions: [{ label: 'Provider status', status: 'ok', reason: 'The provider reports the instance as running.' }, { label: 'Billing & renewal', status: 'unknown', reason: 'No confirmed renewal date is recorded.' }] },
  ...o,
});

const domain = (o: Partial<DomainFacts> = {}): DomainFacts => ({
  id: 'd1', name: 'example.com', registrar: 'Example Registrar', client: null, expiry: { date: '2027-08-13', daysRemaining: 302, source: 'rdap' }, rdapState: 'OK', dnsState: 'OK', dnsChangesInPeriod: 0, dnssec: true,
  nameservers: 2, ssl: { state: 'VALID', validTo: '2026-12-25T00:00:00.000Z', daysRemaining: 71, trusted: true, hosts: 1 }, posture: { spf: true, dmarc: false, caa: false }, ...o,
});

const facts = (o: Partial<ReportFacts> = {}): ReportFacts => ({
  meta: { generatedAt: NOW.toISOString(), period: 'monthly', from: '2026-09-16T00:00:00.000Z', to: NOW.toISOString(), days: 30, label: 'Last 30 days', company: 'Encodency', scope: 'All clients you can access', includesBilling: true },
  summary: { servers: 1, runningServers: 1, monitoredServers: 1, domains: 1, certificates: 1, openAlertsNow: 0, alertsInPeriod: 0, criticalAlertsInPeriod: 0, renewalsNext30Days: 0, unknownRenewalDates: 1, dnsChangesInPeriod: 0, spendInPeriod: [{ currency: 'INR', amount: 1500 }], monthlyEquivalent: [{ currency: 'INR', amount: 1500 }] },
  servers: [server()], domains: [domain()],
  alerts: { byKind: [], bySeverity: [], recent: [] },
  billing: { payments: [{ paidAt: '2026-10-01', asset: 'vmi3611795', amount: 1500, currency: 'INR', invoiceRef: 'INV-1' }], upcoming: [{ asset: 'vmi3611795', kind: 'payment_due', date: '2026-11-01', daysRemaining: 17, amount: 1500, currency: 'INR', verified: true }] },
  reliability: { checks: 40, failedChecks: 1, byKind: [{ kind: 'DNS', total: 20, failed: 0 }, { kind: 'RDAP', total: 20, failed: 1 }], lastProviderSync: NOW.toISOString(), providerSyncFailures: 0 },
  limitations: ['Server CPU, memory and disk figures exist only for servers running the optional collector.'],
  ...o,
});

describe('report period', () => {
  it('resolves the fixed periods', () => {
    for (const [kind, label] of [['daily', 'Last 24 hours'], ['weekly', 'Last 7 days'], ['monthly', 'Last 30 days'], ['yearly', 'Last 365 days']] as const) {
      const p = resolvePeriod(kind, NOW);
      expect('error' in p).toBe(false);
      if (!('error' in p)) { expect(p.label).toBe(label); expect(p.to.getTime()).toBe(NOW.getTime()); expect(p.from < p.to).toBe(true); }
    }
  });
  it('validates custom ranges', () => {
    expect(resolvePeriod('custom', NOW, '2026-10-01', '2026-10-10')).toMatchObject({ days: 10 });
    expect(resolvePeriod('custom', NOW)).toHaveProperty('error');
    expect(resolvePeriod('custom', NOW, '2026-10-10', '2026-10-01')).toHaveProperty('error');
    expect(resolvePeriod('custom', NOW, '2024-01-01', '2026-10-01')).toHaveProperty('error'); // > 366 days
    expect(resolvePeriod('custom', NOW, '2027-01-01', '2027-01-05')).toHaveProperty('error'); // future
    expect(resolvePeriod('custom', NOW, 'nope', '2026-10-01')).toHaveProperty('error');
  });
});

describe('rule-based findings', () => {
  it('raises nothing for a healthy estate except the missing renewal date', () => {
    const f = buildFindings(facts());
    expect(f.map((x) => x.title)).toEqual(['No confirmed renewal date', 'No SPF or DMARC record found'].slice(0, 1));
    expect(overallRisk(f)).toBe('low');
  });
  it('flags pressure, expiry and outages with evidence taken from the facts', () => {
    const f = buildFindings(facts({
      servers: [server({ providerStatus: 'stopped', monitoring: 'offline', metrics: { ...server().metrics!, cpu: { avg: 80, p95: 93, max: 99 }, mem: { avg: 94, p95: 96, max: 97 }, disk: { max: 96, latest: 96 }, swapMax: 60 } })],
      domains: [domain({ expiry: { date: '2026-10-20', daysRemaining: 5, source: 'rdap' }, ssl: { state: 'EXPIRED', validTo: '2026-10-01T00:00:00.000Z', daysRemaining: -14, trusted: false, hosts: 1 } })],
    }));
    const titles = f.map((x) => x.title);
    expect(titles).toEqual(expect.arrayContaining(['Server is not running (stopped)', 'CPU under sustained pressure', 'Memory consistently near capacity', 'Disk almost full', 'Heavy swap usage', 'Domain expires within 7 days', 'SSL certificate has expired', 'Certificate is not trusted']));
    expect(f[0]!.severity).toBe('critical'); // sorted most severe first
    expect(f.find((x) => x.title === 'CPU under sustained pressure')!.evidence).toContain('93%');
    expect(overallRisk(f)).toBe('high');
    expect(new Set(f.map((x) => x.id)).size).toBe(f.length);
  });
  it('treats missing data as unknown, never as a problem or a pass', () => {
    const f = buildFindings(facts({ servers: [server({ monitoring: 'not_configured', metrics: null })], domains: [domain({ expiry: { date: null, daysRemaining: null, source: null }, ssl: { state: 'UNKNOWN', validTo: null, daysRemaining: null, trusted: null, hosts: 0 } })] }));
    expect(f.some((x) => x.title === 'No guest-level monitoring')).toBe(true);
    expect(f.some((x) => x.title === 'Domain expiry date unknown')).toBe(true);
    expect(f.some((x) => /CPU|Memory|Disk/.test(x.title))).toBe(false);
    expect(f.every((x) => x.severity !== 'critical')).toBe(true);
  });
  it('writes a deterministic summary from the same facts', () => {
    const fa = facts();
    const s = automatedSummary(fa, buildFindings(fa));
    expect(s).toContain('1 server');
    expect(s).toContain('1 domain');
    expect(s).toContain('No alerts fired');
  });
});

describe('AI narrative validation', () => {
  const fa = facts({ servers: [server({ providerStatus: 'stopped' })] });
  const findings = buildFindings(fa);
  it('drops references to things that do not exist and bounds free text', () => {
    const n = validateNarrative({
      executiveSummary: 'x'.repeat(5000), riskLevel: 'low', highlights: ['ok', 7, ''],
      priorities: [{ title: 'Start the server', why: 'Down', action: 'Start it', effort: 'banana', findingIds: [findings[0]!.id, 'F99'] }, { title: '', action: '' }],
      serverNotes: [{ name: 'vmi3611795', note: 'real' }, { name: 'ghost-server', note: 'invented' }], domainNotes: [{ name: 'nope.com', note: 'invented' }],
      capacityOutlook: 'fine', nextPeriodFocus: ['a', 'b'],
    }, fa, findings)!;
    expect(n.executiveSummary).toHaveLength(1600);
    expect(n.priorities).toHaveLength(1);
    expect(n.priorities[0]).toMatchObject({ effort: 'medium', findingIds: [findings[0]!.id] });
    expect(n.serverNotes).toEqual([{ name: 'vmi3611795', note: 'real' }]);
    expect(n.domainNotes).toEqual([]);
    expect(n.highlights).toEqual(['ok']);
  });
  it('cannot downgrade the rule-based risk and rejects unusable output', () => {
    const critical = facts({ servers: [server({ suspended: true })] });
    const f = buildFindings(critical);
    expect(validateNarrative({ executiveSummary: 'All good', riskLevel: 'low' }, critical, f)!.riskLevel).toBe('high');
    expect(validateNarrative({ riskLevel: 'low' }, critical, f)).toBeNull();
    expect(validateNarrative('nope', critical, f)).toBeNull();
    expect(validateNarrative(null, critical, f)).toBeNull();
  });
});

describe('PDF rendering', () => {
  const stored = (fa: ReportFacts, ai = false) => {
    const findings = buildFindings(fa);
    return { risk: overallRisk(findings), summary: automatedSummary(fa, findings), findings, ai: ai ? { executiveSummary: 'The estate is stable. One server is stopped and needs a decision.', riskLevel: 'high' as const, highlights: ['One server not running', 'Domain renews in 5 days'], priorities: [{ title: 'Restore vmi3611795', why: 'Provider reports it stopped.', action: 'Start it from the provider panel or confirm the shutdown was intentional.', effort: 'low' as const, findingIds: [findings[0]?.id ?? 'F01'] }], serverNotes: [{ name: 'vmi3611795', note: 'Stopped by the provider status; guest metrics are stale.' }], domainNotes: [{ name: 'example.com', note: 'Renew before the 7-day window.' }], capacityOutlook: 'Memory has headroom; disk is the constraint to watch.', nextPeriodFocus: ['Enable auto-renew', 'Run the collector at boot'] } : null };
  };
  it('renders a multi-page PDF with and without AI, including empty states', async () => {
    const busy = facts({
      servers: [server({ providerStatus: 'stopped', monitoring: 'offline' }), server({ id: 's2', name: 'unmonitored-box', monitoring: 'not_configured', metrics: null, nextDue: { date: '2026-10-18', daysRemaining: 3, verified: true } })],
      domains: [domain({ expiry: { date: '2026-10-20', daysRemaining: 5, source: 'rdap' } }), domain({ id: 'd2', name: 'unknown-expiry.in', expiry: { date: null, daysRemaining: null, source: null }, ssl: { state: 'UNKNOWN', validTo: null, daysRemaining: null, trusted: null, hosts: 0 } })],
      alerts: { byKind: [{ kind: 'RENEWAL_DUE', count: 2 }], bySeverity: [{ severity: 'warning', count: 2 }], recent: [{ title: 'Payment due in 7 days', severity: 'warning', kind: 'RENEWAL_DUE', raisedAt: NOW.toISOString(), state: 'OPEN' }] },
    });
    const withAi = await renderReportPdf({ title: 'T', facts: busy, narrative: stored(busy, true), ai: { status: 'ok', provider: 'openai', model: 'gpt-4.1', error: null }, reportId: '11111111-2222-3333-4444-555555555555' });
    const noAi = await renderReportPdf({ title: 'T', facts: busy, narrative: stored(busy), ai: { status: 'failed', provider: 'openai', model: null, error: 'OpenAI has no credits' }, reportId: '11111111-2222-3333-4444-555555555555' });
    const empty = await renderReportPdf({ title: 'T', facts: facts({ servers: [], domains: [], billing: null, summary: { ...facts().summary, spendInPeriod: null, monthlyEquivalent: null } , meta: { ...facts().meta, includesBilling: false } }), narrative: stored(facts({ servers: [], domains: [] })), ai: { status: 'skipped', provider: null, model: null, error: 'No AI provider key is configured.' }, reportId: 'x' });
    for (const pdf of [withAi, noAi, empty]) {
      expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
      // Size is only a sanity check; compressed size varies with the Node/zlib version (the empty-state PDF is ~6 KB on Node 24).
      expect(pdf.length).toBeGreaterThan(4_000);
    }
    expect((withAi.toString('latin1').match(/\/Type \/Page\b/g) ?? []).length).toBeGreaterThanOrEqual(5);
    if (process.env.REPORT_SAMPLE_OUT) writeFileSync(process.env.REPORT_SAMPLE_OUT, withAi);
  });
});
