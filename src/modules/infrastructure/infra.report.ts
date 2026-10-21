import { Types } from "mongoose";
import { InfraAlert, InfraAsset, InfraBillingRecord, InfraDnsSnapshot, InfraMetricSample, InfraReport, InfraSyncRun } from "../../models/infrastructure/infrastructure.models";
import { logger } from "../../utils/logger";
import { callProvider, modelFor, providerKey, type ProviderId } from "./core/ai-provider";
import { monthlyEquivalent, sumMoney, type BillingCycle } from "./core/billing-math";
import { emailPosture, type DnsRecords } from "./core/dns-intel";
import { buildRenewalItems } from "./core/renewal-items";
import {
  REPORT_PERIODS, automatedSummary, buildFindings, overallRisk, resolvePeriod, validateNarrative,
  type Finding, type Money, type Narrative, type ReportFacts, type ReportPeriod, type ServerFacts, type StoredNarrative,
} from "./core/report/report.model";
import { renderReportPdf } from "./core/report/report.pdf";
import { certificateState } from "./core/ssl-intel";
import { asRows, hydrateAssets } from "./infra.data";
import { monitoringStatus } from "./infra.monitoring";
import { audit, E, errMsg, INFRA_ACTIONS, INFRA_RESOURCE, isoDate, isoTime, money as toMoney, oid, sid, type InfraActor } from "./infra.util";

const MAX_SERVERS = 30;
const MAX_DOMAINS = 80;
const DAILY_LIMIT = 20;

const moneyRows = (m: Map<string, number>): Money[] => [...m.entries()].map(([currency, amount]) => ({ currency, amount: Math.round(amount * 100) / 100 })).sort((a, b) => b.amount - a.amount);

export interface CreateReportInput { period: ReportPeriod; from?: string | null; to?: string | null; includeAi?: boolean }

/* ------------------------------------------------------------------ api */

export async function createReport(actor: InfraActor, input: CreateReportInput, canBilling: boolean) {
  if (!REPORT_PERIODS.includes(input.period)) throw E.badRequest("Unknown report period.", "infra_report_period");
  const p = resolvePeriod(input.period, new Date(), input.from, input.to);
  if ("error" in p) throw E.badRequest(p.error, "infra_report_period");

  const since = new Date(Date.now() - 86_400_000);
  const [recent, running] = await Promise.all([
    InfraReport.countDocuments({ createdAt: { $gte: since } }),
    InfraReport.countDocuments({ status: { $in: ["PENDING", "RUNNING"] }, createdAt: { $gte: new Date(Date.now() - 15 * 60_000) } }),
  ]);
  if (running > 0) throw E.conflict("A report is already being generated. Wait for it to finish.", "infra_report_busy");
  if (recent >= DAILY_LIMIT) throw E.tooMany(`At most ${DAILY_LIMIT} reports can be generated per day.`, "infra_report_limit");

  const title = `Infrastructure Report · ${p.label}`;
  const row = await InfraReport.create({ createdByUserId: actor.userId, period: input.period, periodFrom: p.from, periodTo: p.to, title, aiRequested: input.includeAi !== false, includesBilling: canBilling });
  await audit(actor, { action: INFRA_ACTIONS.REPORT_GENERATED, resourceType: INFRA_RESOURCE.REPORT, resourceId: row._id, metadata: { period: input.period, ai: input.includeAi !== false } });
  // Generation can take a while (database aggregates + an AI call): it runs after the response, the client polls.
  void runReport(sid(row._id), canBilling).catch((e) => logger.error(`infra.report_failed: ${errMsg(e, "unknown")}`));
  return summary(row.toObject());
}

function summary(r: any) {
  const n = (r.narrative ?? null) as StoredNarrative | null;
  return {
    id: sid(r._id), title: r.title, period: r.period, from: isoTime(r.periodFrom), to: isoTime(r.periodTo), status: r.status, clientId: null,
    ai: { requested: r.aiRequested, status: r.aiStatus ?? null, provider: r.aiProvider ?? null, model: r.aiModel ?? null, error: r.aiError ?? null },
    includesBilling: r.includesBilling, risk: n?.risk ?? null, findings: n?.findings.length ?? null, error: r.error ?? null, createdAt: isoTime(r.createdAt), completedAt: isoTime(r.completedAt),
  };
}

const visibleWhere = (actor: InfraActor): Record<string, unknown> => (actor.privileged ? {} : { createdByUserId: actor.userId });

export async function listReports(actor: InfraActor) {
  const rows = await InfraReport.find(visibleWhere(actor)).select("-facts -narrative").sort({ createdAt: -1 }).limit(50).lean<any[]>();
  // The list omits the large payloads, so risk / findings come from a light projection.
  const slim = await InfraReport.find({ _id: { $in: rows.map((r) => r._id) } }).select("narrative.risk narrative.findings").lean<any[]>();
  const by = new Map(slim.map((s) => [sid(s._id), s.narrative as { risk?: string; findings?: unknown[] } | null]));
  return rows.map((r) => {
    const n = by.get(sid(r._id));
    return summary({ ...r, narrative: n ? { risk: n.risk, findings: n.findings ?? [] } : null });
  });
}

export async function getReport(actor: InfraActor, id: string) {
  const row = await InfraReport.findOne({ _id: oid(id, "report id"), ...visibleWhere(actor) }).lean<any>();
  if (!row) throw E.notFound("Report not found.", "infra_report_not_found");
  return { ...summary(row), facts: row.facts ?? null, narrative: row.narrative ?? null };
}

export async function reportPdf(actor: InfraActor, id: string) {
  const row = await InfraReport.findOne({ _id: oid(id, "report id"), ...visibleWhere(actor) }).lean<any>();
  if (!row) throw E.notFound("Report not found.", "infra_report_not_found");
  if (row.status !== "READY" || !row.facts || !row.narrative) throw E.conflict("The report is not ready yet.", "infra_report_not_ready");
  const buffer = await renderReportPdf({
    title: row.title, facts: row.facts as ReportFacts, narrative: row.narrative as StoredNarrative,
    ai: { status: row.aiStatus ?? null, provider: row.aiProvider ?? null, model: row.aiModel ?? null, error: row.aiError ?? null }, reportId: sid(row._id),
  });
  const day = new Date(row.periodTo).toISOString().slice(0, 10);
  return { buffer, fileName: `infrastructure-report-${row.period}-${day}.pdf` };
}

export async function removeReport(actor: InfraActor, id: string) {
  const row = await InfraReport.findOne({ _id: oid(id, "report id"), ...visibleWhere(actor) }).select("_id").lean<any>();
  if (!row) throw E.notFound("Report not found.", "infra_report_not_found");
  await InfraReport.deleteOne({ _id: row._id });
  await audit(actor, { action: INFRA_ACTIONS.REPORT_DELETED, resourceType: INFRA_RESOURCE.REPORT, resourceId: id });
  return { id, deleted: true };
}

/** Marks reports that were interrupted (process restart) as failed so the UI does not wait forever. */
export async function failStaleReports(now = new Date()) {
  const r = await InfraReport.updateMany({ status: { $in: ["PENDING", "RUNNING"] }, createdAt: { $lt: new Date(now.getTime() - 15 * 60_000) } }, { $set: { status: "FAILED", error: "Generation was interrupted. Generate the report again.", completedAt: now } });
  return r.modifiedCount;
}

/* ----------------------------------------------------------- generation */

async function runReport(id: string, canBilling: boolean) {
  await InfraReport.updateOne({ _id: oid(id) }, { $set: { status: "RUNNING" } });
  try {
    const row = await InfraReport.findById(oid(id)).lean<any>();
    if (!row) throw new Error("Report vanished");
    const facts = await gather(row.periodFrom, row.periodTo, row.period as ReportPeriod, canBilling);
    const findings = buildFindings(facts);
    const risk = overallRisk(findings);
    let ai: Narrative | null = null;
    let aiStatus: "ok" | "skipped" | "failed" = "skipped";
    let aiProvider: string | null = null;
    let aiModel: string | null = null;
    let aiError: string | null = null;
    if (row.aiRequested) {
      const out = await narrate(facts, findings);
      ai = out.narrative;
      aiStatus = out.status;
      aiProvider = out.provider;
      aiModel = out.model;
      aiError = out.error;
    } else {
      aiError = "AI analysis was not requested.";
    }
    const stored: StoredNarrative = { risk: ai?.riskLevel ?? risk, summary: automatedSummary(facts, findings), findings, ai };
    await InfraReport.updateOne({ _id: row._id }, { $set: { status: "READY", completedAt: new Date(), facts, narrative: stored, aiStatus, aiProvider, aiModel, aiError: aiError?.slice(0, 300) ?? null } });
  } catch (e) {
    await InfraReport.updateOne({ _id: oid(id) }, { $set: { status: "FAILED", completedAt: new Date(), error: errMsg(e, "Report generation failed").slice(0, 300) } }).catch(() => undefined);
    throw e;
  }
}

type Agg = { assetId: string; samples: number; buckets5: number; cpuAvg: number | null; cpuP95: number | null; cpuMax: number | null; memAvg: number | null; memP95: number | null; memMax: number | null; diskMax: number | null; swapMax: number | null; loadAvg: number | null; loadMax: number | null; rx: number | null; tx: number | null };
type Pt = { assetId: string; b: number; cpu: number | null; mem: number | null; disk: number | null };

const MEM_PCT = { $cond: [{ $gt: ["$memTotalBytes", 0] }, { $multiply: [100, { $divide: [{ $subtract: ["$memTotalBytes", "$memAvailBytes"] }, "$memTotalBytes"] }] }, null] };
const SWAP_PCT = { $cond: [{ $gt: ["$swapTotalBytes", 0] }, { $multiply: [100, { $divide: ["$swapUsedBytes", "$swapTotalBytes"] }] }, null] };

async function aggregateServers(ids: Types.ObjectId[], from: Date, to: Date, bucket: number): Promise<{ aggs: Agg[]; series: Pt[] }> {
  if (!ids.length) return { aggs: [], series: [] };
  const match = { $match: { assetId: { $in: ids }, ts: { $gte: from, $lte: to } } };
  const base = { $addFields: { memPct: MEM_PCT, swapPct: SWAP_PCT, b5: { $floor: { $divide: [{ $toLong: "$ts" }, 300_000] } } } };
  const stats = (withPercentile: boolean) => ({
    $group: {
      _id: "$assetId", samples: { $sum: 1 }, cpuAvg: { $avg: "$cpuPct" }, cpuMax: { $max: "$cpuPct" }, memAvg: { $avg: "$memPct" }, memMax: { $max: "$memPct" },
      diskMax: { $max: "$diskMaxUsedPct" }, swapMax: { $max: "$swapPct" }, loadAvg: { $avg: "$load1" }, loadMax: { $max: "$load1" }, rx: { $avg: "$netRxBps" }, tx: { $avg: "$netTxBps" },
      ...(withPercentile ? { cpuP: { $percentile: { input: "$cpuPct", p: [0.95], method: "approximate" } }, memP: { $percentile: { input: "$memPct", p: [0.95], method: "approximate" } } } : {}),
    },
  });
  let raw: any[];
  try {
    raw = await InfraMetricSample.aggregate([match, base, stats(true)]);
  } catch {
    // $percentile needs MongoDB 7.0+. Older servers still get every other statistic; p95 is reported as unavailable.
    raw = await InfraMetricSample.aggregate([match, base, stats(false)]);
  }
  const buckets = await InfraMetricSample.aggregate([match, base, { $group: { _id: { a: "$assetId", b: "$b5" } } }, { $group: { _id: "$_id.a", n: { $sum: 1 } } }]);
  const bucketsBy = new Map(buckets.map((b: any) => [sid(b._id), b.n as number]));
  const aggs: Agg[] = raw.map((r) => ({
    assetId: sid(r._id), samples: r.samples, buckets5: bucketsBy.get(sid(r._id)) ?? 0, cpuAvg: r.cpuAvg ?? null, cpuP95: r.cpuP?.[0] ?? null, cpuMax: r.cpuMax ?? null,
    memAvg: r.memAvg ?? null, memP95: r.memP?.[0] ?? null, memMax: r.memMax ?? null, diskMax: r.diskMax ?? null, swapMax: r.swapMax ?? null, loadAvg: r.loadAvg ?? null, loadMax: r.loadMax ?? null, rx: r.rx ?? null, tx: r.tx ?? null,
  }));
  const pts = await InfraMetricSample.aggregate([
    match, base,
    { $addFields: { bk: { $multiply: [{ $floor: { $divide: [{ $toLong: "$ts" }, bucket * 1000] } }, bucket] } } },
    { $group: { _id: { a: "$assetId", b: "$bk" }, cpu: { $avg: "$cpuPct" }, mem: { $avg: "$memPct" }, disk: { $max: "$diskMaxUsedPct" } } },
    { $sort: { "_id.b": 1 } },
  ]);
  const series: Pt[] = pts.map((p: any) => ({ assetId: sid(p._id.a), b: Number(p._id.b), cpu: p.cpu ?? null, mem: p.mem ?? null, disk: p.disk ?? null }));
  return { aggs, series };
}

async function gather(from: Date, to: Date, period: ReportPeriod, canBilling: boolean): Promise<ReportFacts> {
  const now = new Date();
  const docs = await InfraAsset.find({ archivedAt: null }).limit(1000).lean<any[]>();
  const assets = await hydrateAssets(docs);
  const servers = assets.filter((a) => a.type === "SERVER").slice(0, MAX_SERVERS);
  const domains = assets.filter((a) => a.type === "DOMAIN").slice(0, MAX_DOMAINS);
  const serverIds = servers.map((s) => new Types.ObjectId(s.id));
  const allIds = assets.map((a) => new Types.ObjectId(a.id));
  const spanSeconds = Math.max(60, Math.round((to.getTime() - from.getTime()) / 1000));
  const bucket = Math.max(600, Math.ceil(spanSeconds / 60 / 300) * 300);
  const expected5m = Math.max(1, Math.ceil(spanSeconds / 300));

  const [{ aggs, series }, alertRows, dnsRows, runRows, payments] = await Promise.all([
    aggregateServers(serverIds, from, to, bucket),
    allIds.length ? InfraAlert.find({ assetId: { $in: allIds }, raisedAt: { $gte: from, $lte: to } }).sort({ raisedAt: -1 }).limit(500).select("assetId kind severity title raisedAt state").lean<any[]>() : [],
    allIds.length ? InfraDnsSnapshot.aggregate([{ $match: { domainId: { $in: allIds }, changed: true, checkedAt: { $gte: from, $lte: to } } }, { $group: { _id: "$domainId", n: { $sum: 1 } } }]) : [],
    allIds.length ? InfraSyncRun.find({ startedAt: { $gte: from, $lte: to }, $or: [{ assetId: { $in: allIds } }, { assetId: null }] }).select("kind status startedAt").lean<any[]>() : [],
    canBilling && allIds.length ? InfraBillingRecord.find({ assetId: { $in: allIds }, kind: "PAYMENT", paidAt: { $gte: from, $lte: to } }).sort({ paidAt: -1 }).limit(200).select("assetId amount currency paidAt invoiceRef").lean<any[]>() : [],
  ]);

  const aggBy = new Map(aggs.map((a) => [a.assetId, a]));
  const ptsBy = new Map<string, Pt[]>();
  for (const p of series) ptsBy.set(p.assetId, [...(ptsBy.get(p.assetId) ?? []), p]);
  const alertBy = new Map<string, number>();
  const openBy = new Map<string, number>();
  for (const a of alertRows) {
    alertBy.set(sid(a.assetId), (alertBy.get(sid(a.assetId)) ?? 0) + 1);
    if (a.state === "OPEN" || a.state === "ACKNOWLEDGED") openBy.set(sid(a.assetId), (openBy.get(sid(a.assetId)) ?? 0) + 1);
  }
  const dnsBy = new Map<string, number>((dnsRows as any[]).map((r) => [sid(r._id), r.n as number]));
  const nameOf = new Map(assets.map((a) => [a.id, a.name]));

  const rows = asRows(assets);
  const renewals = buildRenewalItems(rows, now).filter((i) => i.verified && i.source !== "projected");
  const nextByAsset = new Map<string, (typeof renewals)[number]>();
  for (const i of renewals) if (i.daysRemaining >= -90 && !nextByAsset.has(i.assetId) && i.kind !== "ssl_expiry") nextByAsset.set(i.assetId, i);

  const serverFacts: ServerFacts[] = [];
  for (const s of servers) {
    const ag = aggBy.get(s.id);
    const st = await monitoringStatus(s.id).catch(() => null);
    const cs = (st?.state ?? "not_configured") as ServerFacts["monitoring"];
    const next = nextByAsset.get(s.id);
    serverFacts.push({
      id: s.id, name: s.name, provider: s.provider, plan: s.server?.planName ?? null, region: s.server?.region ?? null, ipv4: s.server?.ipv4 ?? null, environment: s.environment,
      client: null, providerStatus: s.server?.providerStatus ?? null, suspended: s.server?.providerSuspended ?? null,
      monitoring: cs, specs: { vcpu: s.server?.vcpu ?? null, ramMb: s.server?.ramMb ?? null, storageGb: s.server?.storageGb ?? null },
      os: (st?.host as { os?: string | null } | null)?.os ?? s.server?.operatingSystem ?? null, kernel: (st?.host as { kernel?: string | null } | null)?.kernel ?? null,
      uptimeDays: st?.latest?.uptimeSec ? Math.floor(st.latest.uptimeSec / 86400) : null,
      metrics: ag
        ? {
            samples: ag.samples, coveragePct: Math.min(100, Math.round((ag.buckets5 / expected5m) * 100)),
            cpu: { avg: ag.cpuAvg, p95: ag.cpuP95, max: ag.cpuMax }, mem: { avg: ag.memAvg, p95: ag.memP95, max: ag.memMax },
            disk: { max: ag.diskMax, latest: st?.latest?.diskMaxUsedPct ?? null }, swapMax: ag.swapMax, load1: { avg: ag.loadAvg, max: ag.loadMax }, netRxBps: ag.rx, netTxBps: ag.tx,
            series: (ptsBy.get(s.id) ?? []).map((p) => ({ t: p.b * 1000, cpu: p.cpu, mem: p.mem, disk: p.disk })),
          }
        : null,
      openAlerts: openBy.get(s.id) ?? 0, alertsInPeriod: alertBy.get(s.id) ?? 0,
      nextDue: next ? { date: isoDate(next.date), daysRemaining: next.daysRemaining, verified: next.verified } : null,
      health: st ? { overall: st.health.overall, confidence: st.health.confidence, dimensions: st.health.dimensions.map((d) => ({ label: d.label, status: d.status, reason: d.reason })) } : { overall: "unknown", confidence: "low", dimensions: [] },
    });
  }

  const domainFacts = domains.map((a) => {
    const d = a.domain;
    const exp = renewals.find((i) => i.assetId === a.id && i.kind === "domain_expiry") ?? null;
    const certs = a.certificates;
    const states = certs.map((c) => (c.lastCheckedAt ? certificateState(c.validTo, now) : { state: "UNKNOWN" as const, daysRemaining: null }));
    const worst = ["EXPIRED", "EXPIRING", "VALID", "UNKNOWN"].find((x) => states.some((s) => s.state === x)) ?? "UNKNOWN";
    const nearest = certs.filter((c) => c.validTo).sort((x, y) => x.validTo.getTime() - y.validTo.getTime())[0] ?? null;
    return {
      id: a.id, name: a.technicalId ?? a.name, registrar: d?.registrar ?? null, client: null,
      expiry: { date: exp ? isoDate(exp.date) : null, daysRemaining: exp ? exp.daysRemaining : null, source: exp?.source ?? null },
      rdapState: d?.rdapState ?? "NEVER", dnsState: d?.dnsState ?? "NEVER", dnsChangesInPeriod: dnsBy.get(a.id) ?? 0, dnssec: d?.dnssec ?? null, nameservers: d?.nameservers.length ?? 0,
      ssl: { state: worst, validTo: nearest?.validTo ? nearest.validTo.toISOString() : null, daysRemaining: nearest?.validTo ? certificateState(nearest.validTo, now).daysRemaining : null, trusted: certs.length ? !certs.some((c) => c.trusted === false) : null, hosts: certs.length },
      posture: null as { spf: boolean | null; dmarc: boolean | null; caa: boolean | null } | null,
    };
  });
  // DNS posture from each domain's latest stored snapshot.
  for (const d of domainFacts) {
    const snap = await InfraDnsSnapshot.findOne({ domainId: new Types.ObjectId(d.id) }).sort({ checkedAt: -1 }).select("records").lean<any>();
    if (snap) {
      const p = emailPosture(snap.records as DnsRecords);
      d.posture = { spf: p.spf.present, dmarc: p.dmarc.present, caa: p.caa.present };
    }
  }

  const byKind = new Map<string, number>();
  const bySev = new Map<string, number>();
  for (const a of alertRows) {
    byKind.set(a.kind, (byKind.get(a.kind) ?? 0) + 1);
    bySev.set(a.severity, (bySev.get(a.severity) ?? 0) + 1);
  }
  const kinds = new Map<string, { total: number; failed: number }>();
  for (const r of runRows) {
    const k = kinds.get(r.kind) ?? { total: 0, failed: 0 };
    k.total += 1;
    if (r.status === "FAILED") k.failed += 1;
    kinds.set(r.kind, k);
  }
  const lastSync = runRows.filter((r) => r.kind === "PROVIDER_SYNC" && r.status !== "FAILED").sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime())[0];

  let spend: Money[] | null = null;
  let monthly: Money[] | null = null;
  let billing: ReportFacts["billing"] = null;
  if (canBilling) {
    const total = new Map<string, number>();
    for (const p of payments) total.set(p.currency, (total.get(p.currency) ?? 0) + (toMoney(p.amount) ?? 0));
    spend = moneyRows(total);
    const mm = new Map<string, number>();
    for (const a of assets) for (const sub of a.subscriptions) {
      const eq = monthlyEquivalent(sub.amount, sub.cycle as BillingCycle, sub.customIntervalMonths);
      if (eq !== null) mm.set(sub.currency, sumMoney([mm.get(sub.currency), eq]));
    }
    monthly = moneyRows(mm);
    billing = {
      payments: payments.map((p) => ({ paidAt: isoDate(p.paidAt) ?? "", asset: nameOf.get(sid(p.assetId)) ?? "Unknown", amount: toMoney(p.amount) ?? 0, currency: p.currency, invoiceRef: p.invoiceRef ?? null })),
      upcoming: renewals.filter((i) => i.daysRemaining >= 0 && i.daysRemaining <= 90 && i.kind !== "ssl_expiry").slice(0, 40).map((i) => ({ asset: i.assetName, kind: i.kind, date: isoDate(i.date) ?? "", daysRemaining: i.daysRemaining, amount: i.amount, currency: i.currency, verified: i.verified })),
    };
  }

  const unknownRenewals = servers.filter((s) => !nextByAsset.has(s.id)).length;
  const dayCount = Math.max(1, Math.round((to.getTime() - from.getTime()) / 86_400_000));
  const limitations = [
    "Server CPU, memory, disk and network figures exist only for servers running the optional collector; other servers show provider-level data only.",
    "Billing and renewal dates are shown only when confirmed by a registry, a provider or an administrator; projections are never used.",
    "Provider APIs such as Contabo do not publish invoices or renewal dates, so those fields are entered manually.",
    "DNS and registry checks use public resolvers and RDAP; a failed lookup is reported as a failure, not as a change.",
  ];
  if (servers.length < assets.filter((a) => a.type === "SERVER").length) limitations.push(`Only the first ${MAX_SERVERS} servers are detailed.`);
  if (domains.length < assets.filter((a) => a.type === "DOMAIN").length) limitations.push(`Only the first ${MAX_DOMAINS} domains are detailed.`);

  return {
    meta: { generatedAt: now.toISOString(), period, from: from.toISOString(), to: to.toISOString(), days: dayCount, label: period === "custom" ? `${from.toISOString().slice(0, 10)} to ${to.toISOString().slice(0, 10)}` : { daily: "Last 24 hours", weekly: "Last 7 days", monthly: "Last 30 days", yearly: "Last 365 days" }[period], company: process.env.INFRA_COMPANY_NAME || "Bharat Organic Expo", scope: "All infrastructure", includesBilling: canBilling },
    summary: {
      servers: servers.length, runningServers: serverFacts.filter((s) => (s.providerStatus ?? "").toLowerCase() === "running").length,
      monitoredServers: serverFacts.filter((s) => s.monitoring === "online" || s.monitoring === "stale").length, domains: domains.length, certificates: assets.reduce((n, a) => n + a.certificates.length, 0),
      openAlertsNow: [...openBy.values()].reduce((a, b) => a + b, 0), alertsInPeriod: alertRows.length, criticalAlertsInPeriod: alertRows.filter((a) => a.severity === "critical").length,
      renewalsNext30Days: renewals.filter((i) => i.daysRemaining >= 0 && i.daysRemaining <= 30).length, unknownRenewalDates: unknownRenewals,
      dnsChangesInPeriod: [...dnsBy.values()].reduce((a, b) => a + b, 0), spendInPeriod: spend, monthlyEquivalent: monthly,
    },
    servers: serverFacts,
    domains: domainFacts,
    alerts: {
      byKind: [...byKind.entries()].map(([kind, count]) => ({ kind, count })).sort((a, b) => b.count - a.count),
      bySeverity: [...bySev.entries()].map(([severity, count]) => ({ severity, count })),
      recent: alertRows.slice(0, 15).map((a) => ({ title: a.title, severity: a.severity, kind: a.kind, raisedAt: new Date(a.raisedAt).toISOString(), state: a.state })),
    },
    billing,
    reliability: {
      checks: runRows.length, failedChecks: runRows.filter((r) => r.status === "FAILED").length,
      byKind: [...kinds.entries()].map(([kind, v]) => ({ kind, ...v })), lastProviderSync: lastSync ? new Date(lastSync.startedAt).toISOString() : null,
      providerSyncFailures: runRows.filter((r) => r.kind === "PROVIDER_SYNC" && r.status === "FAILED").length,
    },
    limitations,
  };
}

/* ------------------------------------------------------------------- AI */

async function narrate(facts: ReportFacts, findings: Finding[]): Promise<{ narrative: Narrative | null; status: "ok" | "skipped" | "failed"; provider: string | null; model: string | null; error: string | null }> {
  const providers = (["openai", "gemini"] as ProviderId[]).filter((p) => providerKey(p));
  if (!providers.length) return { narrative: null, status: "skipped", provider: null, model: null, error: "No AI provider key is configured on the server." };

  // The model sees a trimmed copy: no chart series, no identifiers it does not need, bounded lists.
  const slim = {
    period: facts.meta, summary: facts.summary,
    servers: facts.servers.map((s) => ({ name: s.name, provider: s.provider, plan: s.plan, region: s.region, status: s.providerStatus, monitoring: s.monitoring, specs: s.specs, os: s.os, uptimeDays: s.uptimeDays, metrics: s.metrics ? { samples: s.metrics.samples, coveragePct: s.metrics.coveragePct, cpu: s.metrics.cpu, mem: s.metrics.mem, disk: s.metrics.disk, swapMax: s.metrics.swapMax, load1: s.metrics.load1, netRxBps: s.metrics.netRxBps, netTxBps: s.metrics.netTxBps } : null, openAlerts: s.openAlerts, alertsInPeriod: s.alertsInPeriod, nextDue: s.nextDue, health: s.health.overall })),
    domains: facts.domains.map((d) => ({ name: d.name, registrar: d.registrar, expiry: d.expiry, ssl: d.ssl, dnsChangesInPeriod: d.dnsChangesInPeriod, dnssec: d.dnssec, posture: d.posture })),
    alerts: { byKind: facts.alerts.byKind, bySeverity: facts.alerts.bySeverity },
    billing: facts.billing ? { spend: facts.summary.spendInPeriod, monthlyEquivalent: facts.summary.monthlyEquivalent, upcoming: facts.billing.upcoming.slice(0, 15) } : null,
    reliability: facts.reliability,
    findings: findings.map((f) => ({ id: f.id, severity: f.severity, area: f.area, subject: f.subject, title: f.title, evidence: f.evidence })),
    limitations: facts.limitations,
  };
  const system = [
    "You are a senior DevOps/SRE analyst writing the narrative section of an infrastructure report for an engineering lead.",
    "PLAN — work through these phases in order, using ONLY the JSON facts provided:",
    "Phase 1 OBSERVE: read the facts end to end. Note fleet size, monitoring coverage, billing shape, alert volume and any gaps (unmonitored servers, unknown dates).",
    "Phase 2 DIAGNOSE: group the findings by area (compute pressure, renewals, certificates, DNS, cost, reliability). State the single most likely cause for each group from the evidence only.",
    "Phase 3 PRIORITISE: order every priority by (severity, days-to-impact, effort). Cheap preventive work that avoids an outage or an expiry always ranks above optimisation.",
    "Phase 4 ADVISE: for each priority give one concrete action with owner (DevOps), effort, and the finding ids it resolves. Close with capacityOutlook (one paragraph: will capacity last the next period?) and nextPeriodFocus (at most 6 items).",
    "RULES: never invent numbers, hostnames, dates, costs, causes or incidents. If something is unknown or unmonitored, say it is unknown.",
    "A server without monitoring has no CPU/RAM/disk data: do not infer it. Unknown dates are unknown, not overdue.",
    "Reference findings by their id. Be specific, concise and actionable. Respond with a single JSON object only.",
    'Schema: {"executiveSummary": string (<= 1200 chars, plain prose: 1 line verdict, 2-3 lines what changed, 1 line risk), "riskLevel": "low"|"medium"|"high", "highlights": string[<=6] (each <= 140 chars, outcome-first),',
    '"priorities": [{"title": string (<= 80 chars, verb-first), "why": string (<= 200 chars, evidence-linked), "action": string (<= 300 chars, single concrete step), "effort": "low"|"medium"|"high", "findingIds": string[]}] (<=8, most important first),',
    '"serverNotes": [{"name": <exact server name>, "note": string}], "domainNotes": [{"name": <exact domain name>, "note": string}],',
    '"capacityOutlook": string (<= 500 chars), "nextPeriodFocus": string[<=6]}',
  ].join("\n");
  const user = `Write the report narrative for this data:\n${JSON.stringify(slim)}`;

  const errors: string[] = [];
  const name = (p: ProviderId) => (p === "openai" ? "OpenAI" : "Gemini");
  for (const provider of providers) {
    const res = await callProvider(provider, { system, user, maxOutputTokens: 3500 });
    if (!res.ok) {
      errors.push(`${name(provider)}: ${res.message}`);
      logger.warn(`infra.report_ai_failed provider=${provider} code=${res.code}`);
      continue;
    }
    let parsed: unknown = null;
    try { parsed = JSON.parse(res.text); } catch { errors.push(`${name(provider)}: returned text that was not valid JSON.`); continue; }
    const narrative = validateNarrative(parsed, facts, findings);
    if (!narrative) { errors.push(`${name(provider)}: returned an unusable analysis.`); continue; }
    return { narrative, status: "ok", provider, model: res.model || modelFor(provider), error: null };
  }
  return { narrative: null, status: "failed", provider: providers[0] ?? null, model: null, error: errors.join(" | ") || "AI analysis failed." };
}
