/**
 * PDF renderer for the infrastructure report (pdfkit, built-in Helvetica: no browser, no network).
 * Layout: cover, executive summary with KPI cards, findings by severity, one card per server (specs, health, metric
 * table, trend chart), domain & SSL table, billing, alerts & reliability, recommendations, appendix. Characters outside
 * Latin-1 are replaced because the built-in font cannot draw them.
 */
import PDFDocument from 'pdfkit';
import type { Finding, Money, ReportFacts, ServerFacts, Severity } from './report.model';
import { SEVERITY_ORDER } from './report.model';
import type { StoredNarrative } from './report.model';

const BRAND = '#2563EB';
const INK = '#1F2A44';
const MUTED = '#5B6B85';
const FAINT = '#94A3B8';
const LINE = '#E3E8F1';
const PANEL = '#F5F8FD';
const OK = '#0B7A55';
const WARN = '#9A5B08';
const BAD = '#C0261F';
const SEV: Record<Severity, { label: string; color: string }> = {
  critical: { label: 'CRITICAL', color: '#C0261F' }, high: { label: 'HIGH', color: '#D9480F' }, medium: { label: 'MEDIUM', color: '#9A5B08' }, low: { label: 'LOW', color: '#2563EB' }, info: { label: 'INFO', color: '#5B6B85' },
};
const M = 40;
const W = 595.28;
const H = 841.89;
const CW = W - M * 2;
const TOP = 66;
// Content stops well above the footer: pdfkit ka page maxY = H - 40 hai, footer uske neeche
// likhoge to wo naya page bana deta hai — isi se extra khaali pages aate the.
const BOTTOM = H - 80;

export interface PdfInput {
  title: string;
  facts: ReportFacts;
  narrative: StoredNarrative;
  ai: { status: string | null; provider: string | null; model: string | null; error: string | null };
  reportId: string;
}

const fmtMoney = (list: Money[] | null) => (!list || !list.length ? 'n/a' : list.map((m) => `${m.currency} ${m.amount.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`).join('  |  '));
const fmtPct = (v: number | null | undefined) => (v === null || v === undefined ? 'n/a' : `${v.toFixed(v >= 10 ? 0 : 1)}%`);
const fmtBytes = (v: number | null | undefined) => {
  if (v === null || v === undefined) return 'n/a';
  const u = ['B/s', 'KB/s', 'MB/s', 'GB/s'];
  let x = v;
  let i = 0;
  while (x >= 1024 && i < u.length - 1) { x /= 1024; i += 1; }
  return `${x.toFixed(x >= 100 ? 0 : 1)} ${u[i]}`;
};
const fmtDate = (iso: string | null | undefined) => (iso ? iso.slice(0, 10) : 'n/a');

export async function renderReportPdf(input: PdfInput): Promise<Buffer> {
  const { facts, narrative } = input;
  const doc = new PDFDocument({ size: 'A4', margin: M, bufferPages: true, info: { Title: input.title, Author: 'Bharat Organic Expo', Subject: `${facts.meta.company} infrastructure report`, CreationDate: new Date(facts.meta.generatedAt) } });
  const chunks: Buffer[] = [];
  doc.on('data', (c: Buffer) => chunks.push(c));
  const done = new Promise<Buffer>((resolve, reject) => { doc.on('end', () => resolve(Buffer.concat(chunks))); doc.on('error', reject); });

  const safe = (v: unknown): string => {
    let out = '';
    for (const ch of String(v ?? '')) {
      const c = ch.codePointAt(0)!;
      if (c === 10 || (c >= 32 && c <= 126) || (c >= 160 && c <= 255) || [0x2013, 0x2014, 0x2018, 0x2019, 0x201c, 0x201d, 0x2022, 0x2026, 0xb7].includes(c)) out += ch;
      else if (c === 0x2192) out += '->';
      else if (c === 0x2264) out += '<=';
      else if (c === 0x2265) out += '>=';
      else out += '?';
    }
    return out;
  };
  const ensure = (h: number) => { if (doc.y + h > BOTTOM) { doc.addPage(); doc.y = TOP; } };
  const gap = (n = 8) => { doc.y += n; };
  const text = (t: string, o: { size?: number; color?: string; bold?: boolean; width?: number; x?: number; gap?: number; align?: 'left' | 'center' | 'right' } = {}) => {
    doc.font(o.bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(o.size ?? 9.5).fillColor(o.color ?? INK);
    const width = o.width ?? CW;
    const h = doc.heightOfString(safe(t), { width });
    ensure(h + 2);
    doc.text(safe(t), o.x ?? M, doc.y, { width, align: o.align ?? 'left' });
    doc.y += o.gap ?? 4;
  };
  const h1 = (t: string) => {
    ensure(46);
    gap(6);
    doc.rect(M, doc.y, 4, 18).fill(BRAND);
    doc.font('Helvetica-Bold').fontSize(15).fillColor(INK).text(safe(t), M + 12, doc.y + 1, { width: CW - 12 });
    doc.y += 16;
    doc.moveTo(M, doc.y).lineTo(M + CW, doc.y).strokeColor(LINE).lineWidth(1).stroke();
    doc.y += 10;
  };
  const h2 = (t: string) => { ensure(28); gap(4); text(t, { size: 11.5, bold: true, gap: 5 }); };
  const chip = (label: string, color: string, x: number, y: number) => {
    const w = doc.font('Helvetica-Bold').fontSize(7).widthOfString(label) + 10;
    doc.roundedRect(x, y, w, 12, 3).fill(color);
    doc.fillColor('#FFFFFF').text(label, x + 5, y + 3, { lineBreak: false });
    return w;
  };

  /** Simple table with repeating header; columns are [label, width fraction]. */
  const table = (cols: Array<[string, number]>, rows: string[][], opts: { colors?: (string | undefined)[][] } = {}) => {
    const widths = cols.map(([, f]) => f * CW);
    const header = () => {
      ensure(24);
      const y = doc.y;
      doc.rect(M, y, CW, 18).fill(PANEL);
      let x = M;
      cols.forEach(([label], i) => { doc.font('Helvetica-Bold').fontSize(7.5).fillColor(MUTED).text(safe(label.toUpperCase()), x + 5, y + 5, { width: widths[i]! - 8, lineBreak: false }); x += widths[i]!; });
      doc.y = y + 20;
    };
    header();
    rows.forEach((r, ri) => {
      doc.font('Helvetica').fontSize(8.2);
      const h = Math.max(16, ...r.map((c, i) => doc.heightOfString(safe(c), { width: widths[i]! - 8 }) + 8));
      if (doc.y + h > BOTTOM) { doc.addPage(); doc.y = TOP; header(); }
      const y = doc.y;
      if (ri % 2 === 1) doc.rect(M, y, CW, h).fill('#FAFBFE');
      let x = M;
      r.forEach((c, i) => {
        const color = opts.colors?.[ri]?.[i];
        doc.font(color ? 'Helvetica-Bold' : 'Helvetica').fontSize(8.2).fillColor(color ?? INK).text(safe(c), x + 5, y + 4, { width: widths[i]! - 8 });
        x += widths[i]!;
      });
      doc.moveTo(M, y + h).lineTo(M + CW, y + h).strokeColor(LINE).lineWidth(0.5).stroke();
      doc.y = y + h;
    });
    gap(8);
  };

  const kpiRow = (items: Array<{ label: string; value: string; sub?: string; color?: string }>) => {
    const per = Math.min(4, items.length);
    const w = (CW - (per - 1) * 6) / per;
    for (let i = 0; i < items.length; i += per) {
      ensure(54);
      const y = doc.y;
      items.slice(i, i + per).forEach((k, j) => {
        const x = M + j * (w + 6);
        doc.save().rect(x, y, w, 46).fill('#FFFFFF').strokeColor(LINE).lineWidth(0.8).stroke().restore();
        doc.save().rect(x, y, w, 2.5).fill(k.color ?? BRAND).restore();
        doc.font('Helvetica-Bold').fontSize(6.8).fillColor(FAINT).text(safe(k.label.toUpperCase()), x + 8, y + 8, { width: w - 16, lineBreak: false });
        doc.font('Helvetica-Bold').fontSize(15).fillColor(k.color ?? INK).text(safe(k.value), x + 8, y + 19, { width: w - 16, lineBreak: false });
        if (k.sub) doc.font('Helvetica').fontSize(6.8).fillColor(MUTED).text(safe(k.sub), x + 8, y + 37, { width: w - 16, lineBreak: false });
      });
      doc.y = y + 54;
    }
  };

  /** Line chart of one or more series with a 0-100 scale; null values break the line (they are gaps, not zeros). */
  const chart = (series: Array<{ label: string; color: string; values: Array<number | null> }>, times: number[], title: string) => {
    const h = 96;
    ensure(h + 30);
    text(title, { size: 8.5, bold: true, color: MUTED, gap: 2 });
    const x0 = M + 28;
    const w = CW - 34;
    const y0 = doc.y + 4;
    doc.rect(x0, y0, w, h).lineWidth(0.5).strokeColor(LINE).stroke();
    for (const g of [0, 50, 100]) {
      const gy = y0 + h - (g / 100) * h;
      doc.moveTo(x0, gy).lineTo(x0 + w, gy).strokeColor(g === 50 ? '#EEF2F8' : LINE).lineWidth(0.4).stroke();
      doc.font('Helvetica').fontSize(6.5).fillColor(FAINT).text(`${g}%`, M, gy - 3, { width: 24, align: 'right', lineBreak: false });
    }
    const n = Math.max(1, times.length - 1);
    series.forEach((s) => {
      let pen = false;
      s.values.forEach((v, i) => {
        if (v === null) { pen = false; return; }
        const x = x0 + (i / n) * w;
        const y = y0 + h - (Math.min(100, Math.max(0, v)) / 100) * h;
        if (!pen) { doc.moveTo(x, y); pen = true; } else doc.lineTo(x, y);
      });
      doc.strokeColor(s.color).lineWidth(1.1).stroke();
    });
    if (times.length > 1) {
      const lab = (t: number) => new Date(t).toISOString().slice(5, 16).replace('T', ' ');
      doc.font('Helvetica').fontSize(6.5).fillColor(FAINT);
      doc.text(lab(times[0]!), x0, y0 + h + 3, { lineBreak: false });
      doc.text(lab(times[times.length - 1]!), x0 + w - 70, y0 + h + 3, { width: 70, align: 'right', lineBreak: false });
    }
    let lx = x0;
    series.forEach((s) => {
      doc.rect(lx, y0 + h + 14, 8, 3).fill(s.color);
      doc.font('Helvetica').fontSize(7).fillColor(MUTED).text(s.label, lx + 11, y0 + h + 11, { lineBreak: false });
      lx += 70;
    });
    doc.y = y0 + h + 26;
  };

  /* ------------------------------------------------------------- cover */
  const riskColor = narrative.risk === 'high' ? BAD : narrative.risk === 'medium' ? WARN : OK;
  // Light cover — full dark/blue band nahi: sirf slim brand accent + white canvas
  doc.rect(0, 0, W, 4).fill(BRAND);
  doc.rect(M, 52, 54, 3).fill(BRAND);
  doc.font('Helvetica-Bold').fontSize(8.5).fillColor(MUTED).text('BHARAT ORGANIC EXPO  |  INFRASTRUCTURE', M, 66, { characterSpacing: 1.5 });
  doc.font('Helvetica-Bold').fontSize(30).fillColor(INK).text('Infrastructure', M, 100, { width: CW });
  doc.font('Helvetica-Bold').fontSize(30).fillColor(INK).text('Health & Renewal Report', M, 136, { width: CW });
  doc.font('Helvetica').fontSize(11.5).fillColor(MUTED).text(safe(facts.meta.label), M, 184, { width: CW });
  doc.y = 216;
  const meta: Array<[string, string]> = [
    ['Organisation', facts.meta.company], ['Scope', facts.meta.scope], ['Reporting period', `${fmtDate(facts.meta.from)} to ${fmtDate(facts.meta.to)} (${facts.meta.days} day${facts.meta.days === 1 ? '' : 's'})`],
    ['Generated', facts.meta.generatedAt.replace('T', ' ').slice(0, 16) + ' UTC'], ['Report ID', input.reportId],
    ['Analysis', input.ai.status === 'ok' ? `AI-assisted narrative (${input.ai.provider}, ${input.ai.model}) over rule-based findings` : 'Rule-based findings (AI narrative not included)'],
  ];
  // Meta as a bordered panel with hairline row dividers
  const metaTop = doc.y;
  meta.forEach(([k, v], mi) => {
    const y = doc.y;
    doc.font('Helvetica-Bold').fontSize(8).fillColor(MUTED).text(safe(k.toUpperCase()), M + 10, y + 2, { width: 120, lineBreak: false });
    doc.font('Helvetica').fontSize(10).fillColor(INK).text(safe(v), M + 140, y, { width: CW - 150 });
    doc.y = Math.max(doc.y, y + 14) + 6;
    if (mi < meta.length - 1) {
      doc.moveTo(M + 10, doc.y - 2).lineTo(M + CW - 10, doc.y - 2).strokeColor('#EEF2F8').lineWidth(0.5).stroke();
    }
  });
  const metaH = doc.y - metaTop + 8;
  doc.save().rect(M, metaTop - 8, CW, metaH).strokeColor(LINE).lineWidth(0.7).stroke().restore();
  gap(14);
  const by = doc.y;
  doc.save().rect(M, by, CW, 62).fill('#FFFFFF').strokeColor(LINE).lineWidth(0.8).stroke().restore();
  // Risk rail on the left edge + verdict panel
  doc.save().rect(M, by, 4, 62).fill(riskColor).restore();
  doc.font('Helvetica-Bold').fontSize(8).fillColor(MUTED).text('OVERALL RISK', M + 16, by + 12, { lineBreak: false });
  doc.font('Helvetica-Bold').fontSize(22).fillColor(riskColor).text(narrative.risk.toUpperCase(), M + 16, by + 26, { lineBreak: false });
  const crit = narrative.findings.filter((f) => f.severity === 'critical').length;
  const high = narrative.findings.filter((f) => f.severity === 'high').length;
  doc.font('Helvetica').fontSize(10).fillColor(INK).text(safe(`${narrative.findings.length} findings: ${crit} critical, ${high} high, ${narrative.findings.length - crit - high} other`), M + 170, by + 29, { width: CW - 190, lineBreak: false });
  doc.y = by + 80;
  text('Every figure in this report is read from stored platform data for the period shown. Dates are included only when confirmed by a registry, a provider API, a live certificate check or an administrator. Items without data are marked unknown, never estimated.', { size: 8.5, color: MUTED, gap: 6 });
  text('Confidential. Prepared for internal operations and DevOps review.', { size: 8.5, color: MUTED });

  /* ---------------------------------------------------------- summary */
  // Cover ke baad seedha content: addPage tabhi jab jagah kam ho (khaali pages ka root cause)
  if (doc.y > BOTTOM - 200) { doc.addPage(); doc.y = TOP; }
  h1('Executive summary');
  if (narrative.ai) {
    text(narrative.ai.executiveSummary, { size: 10, gap: 8 });
    if (narrative.ai.highlights.length) {
      h2('Highlights');
      narrative.ai.highlights.forEach((hl) => text(`•  ${hl}`, { size: 9.2, gap: 3 }));
    }
  } else {
    text(narrative.summary, { size: 10, gap: 8 });
    if (input.ai.error) text(`AI narrative not included: ${input.ai.error}`, { size: 8.5, color: MUTED, gap: 8 });
  }
  gap(4);
  const s = facts.summary;
  kpiRow([
    { label: 'Servers', value: String(s.servers), sub: `${s.runningServers} running` },
    { label: 'Monitored', value: `${s.monitoredServers}/${s.servers}`, sub: 'guest-level metrics', color: s.servers > 0 && s.monitoredServers === 0 ? WARN : INK },
    { label: 'Domains', value: String(s.domains), sub: `${s.certificates} certificate${s.certificates === 1 ? '' : 's'}` },
    { label: 'Alerts in period', value: String(s.alertsInPeriod), sub: `${s.criticalAlertsInPeriod} critical, ${s.openAlertsNow} open`, color: s.criticalAlertsInPeriod ? BAD : INK },
    { label: 'Renewals (30 days)', value: String(s.renewalsNext30Days), sub: 'confirmed dates', color: s.renewalsNext30Days ? WARN : INK },
    { label: 'Unknown renewal dates', value: String(s.unknownRenewalDates), sub: 'servers without a date' },
    ...(facts.meta.includesBilling ? [{ label: 'Spend in period', value: fmtMoney(s.spendInPeriod).slice(0, 22), sub: 'confirmed payments' }, { label: 'Monthly equivalent', value: fmtMoney(s.monthlyEquivalent).slice(0, 22), sub: 'normalised estimate' }] : []),
  ]);

  const prios = narrative.ai?.priorities.length
    ? narrative.ai.priorities.map((p, i) => [String(i + 1), p.title, p.action, p.effort, p.findingIds.join(', ') || '-'])
    : narrative.findings.filter((f) => f.severity === 'critical' || f.severity === 'high').slice(0, 8).map((f, i) => [String(i + 1), `${f.subject}: ${f.title}`, f.recommendation, '-', f.id]);
  if (prios.length) {
    h2(narrative.ai ? 'Priority actions (AI-prioritised)' : 'Priority actions');
    table([['#', 0.05], ['Issue', 0.3], ['Recommended action', 0.45], ['Effort', 0.08], ['Findings', 0.12]], prios);
  } else {
    text('No critical or high-severity findings were raised for this period.', { color: OK, bold: true });
  }

  /* --------------------------------------------------------- findings */
  h1('Findings');
  if (!narrative.findings.length) text('The automated checks raised no findings.', { color: OK });
  else {
    const sorted = [...narrative.findings].sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);
    table(
      [['ID', 0.06], ['Severity', 0.1], ['Area', 0.1], ['Subject', 0.17], ['Finding & evidence', 0.31], ['Recommendation', 0.26]],
      sorted.map((f) => [f.id, SEV[f.severity].label, f.area, f.subject, `${f.title}. ${f.evidence}`, f.recommendation]),
      { colors: sorted.map((f) => [undefined, SEV[f.severity].color, undefined, undefined, undefined, undefined]) },
    );
  }

  /* ---------------------------------------------------------- servers */
  h1('Servers');
  if (!facts.servers.length) text('No servers are tracked in this scope.', { color: MUTED });
  const serverNote = new Map((narrative.ai?.serverNotes ?? []).map((n) => [n.name, n.note]));
  facts.servers.forEach((sv: ServerFacts) => {
    ensure(150);
    const y = doc.y;
    doc.roundedRect(M, y, CW, 34, 4).lineWidth(0.8).fillAndStroke(PANEL, LINE);
    doc.font('Helvetica-Bold').fontSize(11.5).fillColor(INK).text(safe(sv.name), M + 10, y + 7, { width: CW - 150, lineBreak: false });
    doc.font('Helvetica').fontSize(8).fillColor(MUTED).text(safe([sv.provider, sv.plan, sv.region, sv.ipv4].filter(Boolean).join('  |  ') || 'Manually managed server'), M + 10, y + 21, { width: CW - 150, lineBreak: false });
    const hcol = sv.health.overall === 'critical' ? BAD : sv.health.overall === 'warning' ? WARN : sv.health.overall === 'ok' ? OK : MUTED;
    chip(`HEALTH: ${sv.health.overall.toUpperCase()}`, hcol, M + CW - 118, y + 8);
    chip(`${(sv.providerStatus ?? 'status n/a').toUpperCase()}`, (sv.providerStatus ?? '').toLowerCase() === 'running' ? OK : sv.providerStatus ? WARN : MUTED, M + CW - 118, y + 21);
    doc.y = y + 42;
    table([['Specification', 0.25], ['Value', 0.25], ['Operations', 0.25], ['Value', 0.25]], [
      ['vCPU / RAM / disk', `${sv.specs.vcpu ?? 'n/a'} / ${sv.specs.ramMb ? `${(sv.specs.ramMb / 1024).toFixed(0)} GB` : 'n/a'} / ${sv.specs.storageGb ? `${sv.specs.storageGb} GB` : 'n/a'}`, 'Monitoring', sv.monitoring.replace('_', ' ')],
      ['Operating system', sv.os ?? 'n/a', 'Guest uptime', sv.uptimeDays !== null ? `${sv.uptimeDays} days` : 'n/a'],
      ['Environment', sv.environment.toLowerCase(), 'Alerts (period / open)', `${sv.alertsInPeriod} / ${sv.openAlerts}`],
      ['Client', sv.client ?? 'Shared', 'Next confirmed date', sv.nextDue ? `${fmtDate(sv.nextDue.date)} (${sv.nextDue.daysRemaining} d)` : 'unknown'],
    ]);
    if (sv.metrics) {
      const m = sv.metrics;
      table([['Measured (guest OS)', 0.28], ['Average', 0.18], ['95th percentile', 0.18], ['Peak', 0.18], ['Notes', 0.18]], [
        ['CPU', fmtPct(m.cpu.avg), fmtPct(m.cpu.p95), fmtPct(m.cpu.max), (m.cpu.p95 ?? 0) >= 85 ? 'pressure' : 'ok'],
        ['Memory', fmtPct(m.mem.avg), fmtPct(m.mem.p95), fmtPct(m.mem.max), (m.mem.avg ?? 0) >= 90 ? 'pressure' : 'ok'],
        ['Fullest disk', '-', '-', fmtPct(m.disk.max), `now ${fmtPct(m.disk.latest)}`],
        ['Swap (peak)', '-', '-', fmtPct(m.swapMax), ''],
        ['Load 1 min', m.load1.avg === null ? 'n/a' : m.load1.avg.toFixed(2), '-', m.load1.max === null ? 'n/a' : m.load1.max.toFixed(2), `${sv.specs.vcpu ?? '?'} cores`],
        ['Network in / out (avg)', fmtBytes(m.netRxBps), '-', fmtBytes(m.netTxBps), ''],
        ['Data coverage', `${m.samples} samples`, '-', '-', fmtPct(m.coveragePct)],
      ]);
      if (m.series.length > 1) {
        chart(
          [
            { label: 'CPU avg', color: '#DC2626', values: m.series.map((p) => p.cpu) },
            { label: 'Memory avg', color: '#2563EB', values: m.series.map((p) => p.mem) },
            { label: 'Disk peak', color: '#D97706', values: m.series.map((p) => p.disk) },
          ],
          m.series.map((p) => p.t),
          'Resource trend over the period',
        );
      }
    } else {
      text('No guest-level metrics exist for this server in the period. CPU, memory and disk usage are unknown (not zero). Install the optional collector to measure them.', { size: 8.5, color: MUTED, gap: 6 });
    }
    const dims = sv.health.dimensions.filter((d) => d.status !== 'unknown' || true);
    if (dims.length) {
      table([['Health dimension', 0.22], ['Status', 0.12], ['Reason', 0.66]], dims.map((d) => [d.label, d.status, d.reason]), { colors: dims.map((d) => [undefined, d.status === 'critical' ? BAD : d.status === 'warning' ? WARN : d.status === 'ok' ? OK : MUTED, undefined]) });
    }
    const note = serverNote.get(sv.name);
    if (note) text(`Analyst note: ${note}`, { size: 9, color: INK, gap: 10 });
    gap(6);
  });

  /* ---------------------------------------------------------- domains */
  h1('Domains & certificates');
  if (!facts.domains.length) text('No domains are tracked in this scope.', { color: MUTED });
  else {
    const rows = facts.domains.map((d) => [
      d.name, d.registrar ?? 'n/a', d.expiry.date ? `${d.expiry.date}` : 'unknown', d.expiry.daysRemaining === null ? '-' : `${d.expiry.daysRemaining} d`,
      d.ssl.hosts ? `${d.ssl.state.toLowerCase()}${d.ssl.daysRemaining !== null ? ` (${d.ssl.daysRemaining} d)` : ''}` : 'not checked', String(d.dnsChangesInPeriod),
      d.dnssec === null ? 'n/a' : d.dnssec ? 'signed' : 'unsigned',
    ]);
    const colors = facts.domains.map((d) => {
      const days = d.expiry.daysRemaining;
      return [undefined, undefined, days === null ? MUTED : days < 0 || days <= 7 ? BAD : days <= 30 ? WARN : OK, undefined, d.ssl.state === 'EXPIRED' ? BAD : d.ssl.state === 'EXPIRING' ? WARN : d.ssl.state === 'VALID' ? OK : MUTED, undefined, undefined];
    });
    table([['Domain', 0.22], ['Registrar', 0.18], ['Expires', 0.13], ['Left', 0.08], ['SSL', 0.17], ['DNS changes', 0.12], ['DNSSEC', 0.1]], rows, { colors });
    const notes = narrative.ai?.domainNotes ?? [];
    notes.forEach((n) => text(`${n.name}: ${n.note}`, { size: 9, gap: 4 }));
  }

  /* ---------------------------------------------------------- billing */
  if (facts.billing) {
    h1('Billing & renewals');
    kpiRow([{ label: 'Spend in period', value: fmtMoney(facts.summary.spendInPeriod), sub: 'confirmed payments' }, { label: 'Monthly equivalent', value: fmtMoney(facts.summary.monthlyEquivalent), sub: 'normalised, per currency' }]);
    h2('Upcoming (next 90 days)');
    if (!facts.billing.upcoming.length) text('No confirmed dates fall in the next 90 days.', { color: MUTED });
    else table([['Asset', 0.3], ['What', 0.18], ['Date', 0.15], ['In', 0.1], ['Amount', 0.17], ['Source', 0.1]], facts.billing.upcoming.map((u) => [u.asset, u.kind.replace('_', ' '), u.date, `${u.daysRemaining} d`, u.amount === null ? '-' : `${u.currency} ${u.amount}`, u.verified ? 'verified' : 'estimate']));
    h2('Payments recorded in the period');
    if (!facts.billing.payments.length) text('No payments were confirmed in this period.', { color: MUTED });
    else table([['Paid on', 0.16], ['Asset', 0.4], ['Amount', 0.2], ['Reference', 0.24]], facts.billing.payments.map((p) => [p.paidAt, p.asset, `${p.currency} ${p.amount}`, p.invoiceRef ?? '-']));
  }

  /* ----------------------------------------------- alerts & reliability */
  h1('Alerts & reliability');
  if (facts.alerts.byKind.length) table([['Alert type', 0.5], ['Count', 0.5]], facts.alerts.byKind.map((k) => [k.kind.replace(/_/g, ' ').toLowerCase(), String(k.count)]));
  else text('No alerts fired in the period.', { color: OK });
  if (facts.alerts.recent.length) {
    h2('Most recent alerts');
    table([['When (UTC)', 0.2], ['Severity', 0.12], ['State', 0.12], ['Alert', 0.56]], facts.alerts.recent.map((a) => [a.raisedAt.slice(0, 16).replace('T', ' '), a.severity, a.state.toLowerCase(), a.title]));
  }
  h2('Automated checks');
  table([['Check', 0.4], ['Runs', 0.2], ['Failed', 0.2], ['Failure rate', 0.2]], facts.reliability.byKind.length ? facts.reliability.byKind.map((k) => [k.kind.replace(/_/g, ' ').toLowerCase(), String(k.total), String(k.failed), k.total ? `${Math.round((k.failed / k.total) * 100)}%` : '-']) : [['No checks recorded', '-', '-', '-']]);

  /* --------------------------------------------------- recommendations */
  h1('Recommendations & next period');
  if (narrative.ai) {
    if (narrative.ai.capacityOutlook) { h2('Capacity outlook'); text(narrative.ai.capacityOutlook, { gap: 8 }); }
    if (narrative.ai.nextPeriodFocus.length) { h2('Focus for the next period'); narrative.ai.nextPeriodFocus.forEach((x) => text(`•  ${x}`, { gap: 3 })); }
  } else {
    h2('Focus for the next period');
    const focus = narrative.findings.filter((f) => ['critical', 'high', 'medium'].includes(f.severity)).slice(0, 8);
    if (!focus.length) text('No medium-or-higher findings. Keep monitoring and confirm renewal dates.', { color: MUTED });
    focus.forEach((f) => text(`•  ${f.subject}: ${f.recommendation}`, { gap: 3 }));
  }

  /* ---------------------------------------------------------- appendix */
  h1('Appendix: method, sources and limitations');
  h2('How this report was produced');
  [
    'Facts are aggregated from the platform database for the period: guest metrics pushed by the optional collector, provider API snapshots, registry (RDAP) and DNS lookups, live TLS handshakes, alerts and payment records.',
    'Findings are produced by fixed rules (thresholds: CPU p95 >= 85%, memory average >= 90%, disk >= 85% / 95%, domains expiring within 7 / 30 / 60 days, and similar). Each finding lists its evidence.',
    input.ai.status === 'ok'
      ? `The narrative and prioritisation were written by an AI model (${input.ai.provider} / ${input.ai.model}) from the same facts and findings. Its output is validated: it may only reference existing findings, servers and domains, and may not lower the rule-based risk level. Review it as a draft.`
      : `No AI narrative is included${input.ai.error ? ` (${input.ai.error})` : ''}. The summary above is generated from the facts by fixed templates.`,
    'Percentiles are computed over stored samples (about one per minute). Coverage is the share of 5-minute windows that contain at least one sample.',
  ].forEach((t) => text(`•  ${t}`, { size: 9, gap: 4 }));
  h2('Limitations');
  facts.limitations.forEach((t) => text(`•  ${t}`, { size: 9, gap: 4 }));
  h2('Glossary');
  text('p95: the value below which 95% of samples fall. Coverage: share of the period with monitoring data. Verified date: confirmed by a registry, provider API or administrator (never inferred).', { size: 9 });

  // header + footer on every page; header cover pe nahi (title already hai)
  const range = doc.bufferedPageRange();
  for (let i = range.start; i < range.start + range.count; i += 1) {
    doc.switchToPage(i);
    if (i > range.start) {
      doc.font('Helvetica-Bold').fontSize(8).fillColor(INK).text('Bharat Organic Expo', M, 28, { lineBreak: false });
      doc.font('Helvetica').fontSize(8).fillColor(MUTED).text('Infrastructure', M + 70, 28, { lineBreak: false });
      doc.font('Helvetica').fontSize(7.5).fillColor(FAINT).text(safe(`${facts.meta.label}  |  ${facts.meta.company}`), M + 170, 28, { width: CW - 170, align: 'right', lineBreak: false });
      doc.moveTo(M, 44).lineTo(M + CW, 44).strokeColor(LINE).lineWidth(0.6).stroke();
    }
    // Footer: sab kuch maxY (H - 40) ke upar — neeche likhoge to pdfkit naya page bana deta hai
    doc.moveTo(M, H - 72).lineTo(M + CW, H - 72).strokeColor(LINE).lineWidth(0.6).stroke();
    doc.font('Helvetica').fontSize(7.5).fillColor(FAINT).text(safe(`Confidential  |  Report ${input.reportId.slice(0, 8)}  |  Generated ${facts.meta.generatedAt.slice(0, 10)}`), M, H - 64, { lineBreak: false });
    doc.text(`Page ${i - range.start + 1} of ${range.count}`, M, H - 64, { width: CW, align: 'right', lineBreak: false });
  }
  doc.end();
  return done;
}

export type { Finding };
