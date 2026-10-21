/**
 * Infrastructure report: the fact model, the rule-based findings engine, period maths and the AI-narrative validator.
 * Everything here is pure. Facts come only from stored data; findings are derived by fixed rules with their evidence;
 * the AI may only rephrase and prioritise what is in here, and its output is validated against it.
 */

export type ReportPeriod = 'daily' | 'weekly' | 'monthly' | 'yearly' | 'custom';
export const REPORT_PERIODS: readonly ReportPeriod[] = ['daily', 'weekly', 'monthly', 'yearly', 'custom'];
export const MAX_CUSTOM_DAYS = 366;

export type Severity = 'critical' | 'high' | 'medium' | 'low' | 'info';
export const SEVERITY_ORDER: Record<Severity, number> = { critical: 0, high: 1, medium: 2, low: 3, info: 4 };

export interface Money { currency: string; amount: number }

export interface MetricStat { avg: number | null; p95: number | null; max: number | null }

export interface ServerFacts {
  id: string;
  name: string;
  provider: string | null;
  plan: string | null;
  region: string | null;
  ipv4: string | null;
  environment: string;
  client: string | null;
  providerStatus: string | null;
  suspended: boolean | null;
  monitoring: 'not_configured' | 'pending' | 'online' | 'stale' | 'offline' | 'revoked';
  specs: { vcpu: number | null; ramMb: number | null; storageGb: number | null };
  os: string | null;
  kernel: string | null;
  uptimeDays: number | null;
  /** Null when no guest metrics exist in the period: never zeros. */
  metrics: null | {
    samples: number;
    coveragePct: number | null;
    cpu: MetricStat;
    mem: MetricStat;
    disk: { max: number | null; latest: number | null };
    swapMax: number | null;
    load1: { avg: number | null; max: number | null };
    netRxBps: number | null;
    netTxBps: number | null;
    series: Array<{ t: number; cpu: number | null; mem: number | null; disk: number | null }>;
  };
  openAlerts: number;
  alertsInPeriod: number;
  nextDue: { date: string | null; daysRemaining: number; verified: boolean } | null;
  health: { overall: string; confidence: string; dimensions: Array<{ label: string; status: string; reason: string }> };
}

export interface DomainFacts {
  id: string;
  name: string;
  registrar: string | null;
  client: string | null;
  expiry: { date: string | null; daysRemaining: number | null; source: string | null };
  rdapState: string;
  dnsState: string;
  dnsChangesInPeriod: number;
  dnssec: boolean | null;
  nameservers: number;
  ssl: { state: string; validTo: string | null; daysRemaining: number | null; trusted: boolean | null; hosts: number };
  posture: { spf: boolean | null; dmarc: boolean | null; caa: boolean | null } | null;
}

export interface ReportFacts {
  meta: {
    generatedAt: string;
    period: ReportPeriod;
    from: string;
    to: string;
    days: number;
    label: string;
    company: string;
    scope: string;
    includesBilling: boolean;
  };
  summary: {
    servers: number;
    runningServers: number;
    monitoredServers: number;
    domains: number;
    certificates: number;
    openAlertsNow: number;
    alertsInPeriod: number;
    criticalAlertsInPeriod: number;
    renewalsNext30Days: number;
    unknownRenewalDates: number;
    dnsChangesInPeriod: number;
    spendInPeriod: Money[] | null;
    monthlyEquivalent: Money[] | null;
  };
  servers: ServerFacts[];
  domains: DomainFacts[];
  alerts: { byKind: Array<{ kind: string; count: number }>; bySeverity: Array<{ severity: string; count: number }>; recent: Array<{ title: string; severity: string; kind: string; raisedAt: string; state: string }> };
  billing: null | {
    payments: Array<{ paidAt: string; asset: string; amount: number; currency: string; invoiceRef: string | null }>;
    upcoming: Array<{ asset: string; kind: string; date: string; daysRemaining: number; amount: number | null; currency: string | null; verified: boolean }>;
  };
  reliability: { checks: number; failedChecks: number; byKind: Array<{ kind: string; total: number; failed: number }>; lastProviderSync: string | null; providerSyncFailures: number };
  limitations: string[];
}

export interface Finding {
  id: string;
  severity: Severity;
  area: 'server' | 'domain' | 'ssl' | 'billing' | 'monitoring' | 'reliability' | 'capacity';
  subject: string;
  title: string;
  evidence: string;
  recommendation: string;
}

/* ---------------------------------------------------------------- period */

const DAY = 86_400_000;
const startOfUtcDay = (d: Date) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));

export function resolvePeriod(kind: ReportPeriod, now: Date, from?: string | null, to?: string | null): { from: Date; to: Date; label: string; days: number } | { error: string } {
  const today = startOfUtcDay(now);
  let start: Date;
  let end: Date;
  if (kind === 'custom') {
    if (!from || !to) return { error: 'A custom report needs a start and an end date.' };
    start = new Date(`${from}T00:00:00.000Z`);
    end = new Date(`${to}T23:59:59.999Z`);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return { error: 'Dates must be valid calendar dates.' };
    if (end < start) return { error: 'The end date must not be before the start date.' };
    if (end.getTime() - start.getTime() > MAX_CUSTOM_DAYS * DAY) return { error: `A custom report can cover at most ${MAX_CUSTOM_DAYS} days.` };
    if (start.getTime() > now.getTime()) return { error: 'The start date is in the future.' };
    if (end.getTime() > now.getTime()) end = now;
  } else {
    end = now;
    const days = { daily: 1, weekly: 7, monthly: 30, yearly: 365 }[kind];
    start = new Date(today.getTime() - (days - 1) * DAY);
    if (kind === 'daily') start = new Date(now.getTime() - DAY);
  }
  const days = Math.max(1, Math.round((end.getTime() - start.getTime()) / DAY));
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  const label = kind === 'daily' ? 'Last 24 hours' : kind === 'weekly' ? 'Last 7 days' : kind === 'monthly' ? 'Last 30 days' : kind === 'yearly' ? 'Last 365 days' : `${fmt(start)} to ${fmt(end)}`;
  return { from: start, to: end, label, days };
}

/* -------------------------------------------------------------- findings */

const fmtPct = (v: number | null) => (v === null ? 'n/a' : `${v.toFixed(v >= 10 ? 0 : 1)}%`);

/** Deterministic findings with their evidence. This is the report's backbone and exists with or without AI. */
export function buildFindings(f: ReportFacts): Finding[] {
  const out: Finding[] = [];
  const add = (x: Omit<Finding, 'id'>) => out.push({ ...x, id: `F${String(out.length + 1).padStart(2, '0')}` });

  for (const s of f.servers) {
    const st = (s.providerStatus ?? '').toLowerCase();
    if (s.suspended) add({ severity: 'critical', area: 'server', subject: s.name, title: 'Server is suspended by the provider', evidence: `The provider reports "${s.name}" as suspended.`, recommendation: 'Contact the provider and resolve the suspension reason (usually payment or abuse) immediately.' });
    else if (['stopped', 'offline', 'shutdown', 'error', 'uninstalled'].includes(st)) add({ severity: 'high', area: 'server', subject: s.name, title: `Server is not running (${s.providerStatus})`, evidence: `Provider status is "${s.providerStatus}".`, recommendation: 'Confirm whether the shutdown was intentional; start the server from the provider panel if it should be live.' });

    if (s.monitoring === 'offline') add({ severity: 'medium', area: 'monitoring', subject: s.name, title: 'Monitoring collector stopped reporting', evidence: 'No guest metrics were received recently, although the collector was previously configured.', recommendation: 'Check that the collector process and the network path to the API are up. The server itself may still be running.' });
    if (s.monitoring === 'not_configured' || s.monitoring === 'pending') add({ severity: 'low', area: 'monitoring', subject: s.name, title: s.monitoring === 'pending' ? 'Monitoring set up but no data received' : 'No guest-level monitoring', evidence: 'Only provider-level data is available: CPU, memory and disk usage are not measured.', recommendation: 'Run the optional collector so capacity and pressure can be assessed.' });

    const m = s.metrics;
    if (m) {
      if ((m.cpu.p95 ?? 0) >= 85) add({ severity: 'medium', area: 'capacity', subject: s.name, title: 'CPU under sustained pressure', evidence: `CPU p95 was ${fmtPct(m.cpu.p95)} (average ${fmtPct(m.cpu.avg)}, peak ${fmtPct(m.cpu.max)}) over ${m.samples} samples.`, recommendation: 'Identify the busiest workload; consider optimisation or a larger plan if this is the normal level.' });
      if ((m.mem.avg ?? 0) >= 90) add({ severity: 'high', area: 'capacity', subject: s.name, title: 'Memory consistently near capacity', evidence: `Average memory use was ${fmtPct(m.mem.avg)} (peak ${fmtPct(m.mem.max)}).`, recommendation: 'Review memory-heavy processes and containers; add RAM or limits before the OOM killer acts.' });
      else if ((m.mem.avg ?? 0) >= 80) add({ severity: 'low', area: 'capacity', subject: s.name, title: 'Memory use is high', evidence: `Average memory use was ${fmtPct(m.mem.avg)}.`, recommendation: 'Plan capacity: headroom is limited.' });
      const dMax = m.disk.max ?? 0;
      if (dMax >= 95) add({ severity: 'critical', area: 'capacity', subject: s.name, title: 'Disk almost full', evidence: `The fullest filesystem reached ${fmtPct(m.disk.max)}.`, recommendation: 'Free space or expand storage now; full disks stop databases and logs.' });
      else if (dMax >= 85) add({ severity: 'high', area: 'capacity', subject: s.name, title: 'Disk usage is high', evidence: `The fullest filesystem reached ${fmtPct(m.disk.max)}.`, recommendation: 'Clean logs/images or plan more storage before it reaches 95%.' });
      if ((m.swapMax ?? 0) >= 50) add({ severity: 'medium', area: 'capacity', subject: s.name, title: 'Heavy swap usage', evidence: `Swap peaked at ${fmtPct(m.swapMax)}.`, recommendation: 'Swapping signals memory shortage; investigate memory consumers.' });
      if (m.coveragePct !== null && m.coveragePct < 80) add({ severity: 'low', area: 'monitoring', subject: s.name, title: 'Monitoring data has gaps', evidence: `Samples cover only ${fmtPct(m.coveragePct)} of the period.`, recommendation: 'Make the collector start on boot (systemd) and keep its network path reliable.' });
    }
    if (s.nextDue && s.nextDue.daysRemaining < 0) add({ severity: 'critical', area: 'billing', subject: s.name, title: 'Payment or expiry date has passed', evidence: `The confirmed date ${s.nextDue.date} was ${-s.nextDue.daysRemaining} day(s) ago.`, recommendation: 'Confirm payment with the provider and record it, or update the date.' });
    else if (s.nextDue && s.nextDue.daysRemaining <= 7) add({ severity: 'high', area: 'billing', subject: s.name, title: 'Renewal due within 7 days', evidence: `Due ${s.nextDue.date} (${s.nextDue.daysRemaining} day(s)).`, recommendation: 'Make sure payment is arranged.' });
    else if (s.nextDue && s.nextDue.daysRemaining <= 30) add({ severity: 'medium', area: 'billing', subject: s.name, title: 'Renewal due within 30 days', evidence: `Due ${s.nextDue.date} (${s.nextDue.daysRemaining} day(s)).`, recommendation: 'Schedule the payment.' });
    if (!s.nextDue) add({ severity: 'low', area: 'billing', subject: s.name, title: 'No confirmed renewal date', evidence: 'No payment or expiry date is recorded for this server.', recommendation: 'Enter the verified renewal date so reminders can work.' });
  }

  for (const d of f.domains) {
    const days = d.expiry.daysRemaining;
    if (days === null) add({ severity: 'low', area: 'domain', subject: d.name, title: 'Domain expiry date unknown', evidence: `Registry lookup state: ${d.rdapState}. No expiry is recorded.`, recommendation: 'Confirm the expiry with the registrar and enter it manually if the registry does not publish it.' });
    else if (days < 0) add({ severity: 'critical', area: 'domain', subject: d.name, title: 'Domain registration has expired', evidence: `Expired ${-days} day(s) ago (${d.expiry.date}).`, recommendation: 'Renew immediately; the domain may be in a redemption period with extra fees.' });
    else if (days <= 7) add({ severity: 'critical', area: 'domain', subject: d.name, title: 'Domain expires within 7 days', evidence: `Expires ${d.expiry.date} (${days} day(s)).`, recommendation: 'Renew now and enable auto-renew at the registrar.' });
    else if (days <= 30) add({ severity: 'high', area: 'domain', subject: d.name, title: 'Domain expires within 30 days', evidence: `Expires ${d.expiry.date} (${days} days).`, recommendation: 'Renew and verify auto-renew.' });
    else if (days <= 60) add({ severity: 'medium', area: 'domain', subject: d.name, title: 'Domain expires within 60 days', evidence: `Expires ${d.expiry.date} (${days} days).`, recommendation: 'Plan the renewal.' });

    const sslState = d.ssl.state;
    if (sslState === 'EXPIRED') add({ severity: 'critical', area: 'ssl', subject: d.name, title: 'SSL certificate has expired', evidence: `Valid until ${d.ssl.validTo}.`, recommendation: 'Renew the certificate now; browsers show a security warning.' });
    else if (sslState === 'EXPIRING') add({ severity: 'high', area: 'ssl', subject: d.name, title: 'SSL certificate expiring soon', evidence: `Valid until ${d.ssl.validTo} (${d.ssl.daysRemaining} day(s)).`, recommendation: 'Confirm automatic renewal works, or renew manually.' });
    if (d.ssl.trusted === false) add({ severity: 'high', area: 'ssl', subject: d.name, title: 'Certificate is not trusted', evidence: 'The chain or hostname validation failed at the last live check.', recommendation: 'Install the complete chain and make sure the certificate names the hostname.' });
    if (d.dnsChangesInPeriod > 0) add({ severity: 'info', area: 'domain', subject: d.name, title: 'DNS records changed', evidence: `${d.dnsChangesInPeriod} change event(s) detected in the period.`, recommendation: 'Confirm these changes were intentional.' });
    if (d.posture && d.posture.spf === false && d.posture.dmarc === false) add({ severity: 'info', area: 'domain', subject: d.name, title: 'No SPF or DMARC record found', evidence: 'Neither record was found at the last DNS check.', recommendation: 'If this domain sends email, publish SPF and DMARC to reduce spoofing. Ignore if it sends no mail.' });
  }

  if (f.reliability.providerSyncFailures > 0) add({ severity: 'medium', area: 'reliability', subject: 'Provider synchronisation', title: 'Provider sync failed during the period', evidence: `${f.reliability.providerSyncFailures} failed synchronisation run(s).`, recommendation: 'Test the provider connection and re-enter credentials if authentication fails.' });
  if (f.reliability.checks > 0 && f.reliability.failedChecks / f.reliability.checks > 0.2) add({ severity: 'low', area: 'reliability', subject: 'Automated checks', title: 'Many automated checks failed', evidence: `${f.reliability.failedChecks} of ${f.reliability.checks} checks failed.`, recommendation: 'Review the failing registry/DNS/SSL checks on the Alerts page.' });
  if (f.summary.criticalAlertsInPeriod > 0) add({ severity: 'medium', area: 'reliability', subject: 'Alerts', title: 'Critical alerts were raised', evidence: `${f.summary.criticalAlertsInPeriod} critical alert(s) in the period.`, recommendation: 'Review the alert history for recurring causes.' });

  return out.sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]).map((x, i) => ({ ...x, id: `F${String(i + 1).padStart(2, '0')}` }));
}

export function overallRisk(findings: Finding[]): 'low' | 'medium' | 'high' {
  if (findings.some((f) => f.severity === 'critical')) return 'high';
  if (findings.some((f) => f.severity === 'high') || findings.filter((f) => f.severity === 'medium').length >= 3) return 'medium';
  return 'low';
}

/* ------------------------------------------------------------- narrative */

export interface Narrative {
  executiveSummary: string;
  riskLevel: 'low' | 'medium' | 'high';
  highlights: string[];
  priorities: Array<{ title: string; why: string; action: string; effort: 'low' | 'medium' | 'high'; findingIds: string[] }>;
  serverNotes: Array<{ name: string; note: string }>;
  domainNotes: Array<{ name: string; note: string }>;
  capacityOutlook: string;
  nextPeriodFocus: string[];
}

const clip = (v: unknown, max: number): string => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, max) : '');

/**
 * Accepts the model's JSON only if it has the expected shape, and removes anything that points at an unknown finding,
 * server or domain. Free text is length-bounded. Returns null when nothing usable is left.
 */
export function validateNarrative(raw: unknown, facts: ReportFacts, findings: Finding[]): Narrative | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const ids = new Set(findings.map((f) => f.id));
  const serverNames = new Set(facts.servers.map((s) => s.name));
  const domainNames = new Set(facts.domains.map((d) => d.name));
  const executiveSummary = clip(r.executiveSummary, 1600);
  if (!executiveSummary) return null;
  const list = (v: unknown, n: number, len: number) => (Array.isArray(v) ? v.map((x) => clip(x, len)).filter(Boolean).slice(0, n) : []);
  const priorities = (Array.isArray(r.priorities) ? r.priorities : []).slice(0, 8).flatMap((p) => {
    const o = (p ?? {}) as Record<string, unknown>;
    const title = clip(o.title, 140);
    const action = clip(o.action, 400);
    if (!title || !action) return [];
    const findingIds = (Array.isArray(o.findingIds) ? o.findingIds : []).filter((x): x is string => typeof x === 'string' && ids.has(x)).slice(0, 6);
    const effort: 'low' | 'medium' | 'high' = o.effort === 'low' || o.effort === 'medium' || o.effort === 'high' ? o.effort : 'medium';
    return [{ title, why: clip(o.why, 400), action, effort, findingIds }];
  });
  const notes = (v: unknown, allowed: Set<string>) =>
    (Array.isArray(v) ? v : []).slice(0, 40).flatMap((n) => {
      const o = (n ?? {}) as Record<string, unknown>;
      const name = clip(o.name, 200);
      const note = clip(o.note, 500);
      return name && note && allowed.has(name) ? [{ name, note }] : [];
    });
  const risk = r.riskLevel === 'low' || r.riskLevel === 'medium' || r.riskLevel === 'high' ? r.riskLevel : overallRisk(findings);
  return {
    executiveSummary,
    // The deterministic risk level is the floor: the model may not play a critical finding down.
    riskLevel: ({ low: 0, medium: 1, high: 2 } as const)[risk] >= ({ low: 0, medium: 1, high: 2 } as const)[overallRisk(findings)] ? risk : overallRisk(findings),
    highlights: list(r.highlights, 6, 300),
    priorities,
    serverNotes: notes(r.serverNotes, serverNames),
    domainNotes: notes(r.domainNotes, domainNames),
    capacityOutlook: clip(r.capacityOutlook, 700),
    nextPeriodFocus: list(r.nextPeriodFocus, 6, 240),
  };
}

/** Plain-language summary used when no AI narrative is available. Every number is read from the facts. */
export function automatedSummary(f: ReportFacts, findings: Finding[]): string {
  const s = f.summary;
  const c = findings.filter((x) => x.severity === 'critical').length;
  const h = findings.filter((x) => x.severity === 'high').length;
  const parts = [
    `${f.meta.label}: ${s.servers} server${s.servers === 1 ? '' : 's'} (${s.runningServers} running, ${s.monitoredServers} with guest monitoring) and ${s.domains} domain${s.domains === 1 ? '' : 's'} were reviewed.`,
    findings.length === 0 ? 'No findings were raised by the automated checks.' : `The automated checks raised ${findings.length} finding${findings.length === 1 ? '' : 's'}: ${c} critical, ${h} high.`,
    s.alertsInPeriod ? `${s.alertsInPeriod} alert${s.alertsInPeriod === 1 ? '' : 's'} fired in the period (${s.criticalAlertsInPeriod} critical); ${s.openAlertsNow} still open.` : 'No alerts fired in the period.',
    s.renewalsNext30Days ? `${s.renewalsNext30Days} renewal or expiry date${s.renewalsNext30Days === 1 ? '' : 's'} fall within the next 30 days.` : 'No confirmed renewal falls within the next 30 days.',
  ];
  if (s.unknownRenewalDates) parts.push(`${s.unknownRenewalDates} asset${s.unknownRenewalDates === 1 ? ' has' : 's have'} no known renewal date.`);
  return parts.join(' ');
}

/** What a finished report stores as its narrative: the rule-based findings plus the (optional) validated AI analysis. */
export interface StoredNarrative { risk: 'low' | 'medium' | 'high'; summary: string; findings: Finding[]; ai: Narrative | null }
