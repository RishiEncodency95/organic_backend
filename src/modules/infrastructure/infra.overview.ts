import { Types } from "mongoose";
import { InfraAlert, InfraAsset, InfraBillingRecord, InfraDnsSnapshot, InfraMetricSample, InfraProviderConnection, InfraSyncRun } from "../../models/infrastructure/infrastructure.models";
import { monthlyEquivalent, projectOccurrences, startOfUtcDay, utcDate, type BillingCycle } from "./core/billing-math";
import { anchorDayOf, buildRenewalItems, effectiveDomainExpiry, unknownRenewalAssets, type RenewalItem } from "./core/renewal-items";
import { certificateState } from "./core/ssl-intel";
import { collectorState } from "./core/server-metrics";
import { asRows, hydrateAssets, loadActiveAssets, type LoadedAsset } from "./infra.data";
import { isoDate, isoTime, money, sid } from "./infra.util";

const CLIENT_NAME = "Shared / company-wide";

function addTo(map: Map<string, number>, key: string, value: number) {
  map.set(key, Math.round(((map.get(key) ?? 0) + value) * 100) / 100);
}

/** Money is reported per currency: amounts in different currencies are never summed together. */
function currencyRows(map: Map<string, number>) {
  return [...map.entries()].map(([currency, amount]) => ({ currency, amount })).sort((a, b) => b.amount - a.amount);
}

const collectorStateOf = (c: { revokedAt: Date | null; lastSampleAt: Date | null } | null, now: Date) =>
  collectorState({ now, hasCollector: Boolean(c), collectorRevoked: Boolean(c?.revokedAt), lastSampleAt: c?.lastSampleAt ?? null });

const csvCell = (v: unknown): string => {
  let s = v === null || v === undefined ? "" : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`; // spreadsheet formula injection guard
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
export const toCsv = (header: string[], rows: unknown[][]) => [header, ...rows].map((r) => r.map(csvCell).join(",")).join("\r\n");

function itemView(i: RenewalItem, canBilling: boolean) {
  return {
    key: i.key, assetId: i.assetId, assetName: i.assetName, assetType: i.assetType, kind: i.kind, date: isoDate(i.date), daysRemaining: i.daysRemaining, source: i.source, verified: i.verified,
    label: i.label, subscriptionId: i.subscriptionId, amount: canBilling ? i.amount : null, currency: canBilling ? i.currency : null, paymentStatus: canBilling ? i.paymentStatus : null,
  };
}

async function openAlertCounts(ids: unknown[]): Promise<Map<string, number>> {
  if (!ids.length) return new Map();
  const rows = await InfraAlert.aggregate([{ $match: { assetId: { $in: ids }, state: { $in: ["OPEN", "ACKNOWLEDGED"] } } }, { $group: { _id: "$assetId", n: { $sum: 1 } } }]);
  return new Map(rows.map((r: any) => [sid(r._id), r.n as number]));
}

/* ------------------------------------------------------------- renewals */

export async function renewals(q: { window?: string; kind?: string }, canBilling: boolean) {
  const now = new Date();
  let items = buildRenewalItems(asRows(await loadActiveAssets()), now);
  if (q.kind) items = items.filter((i) => i.kind === q.kind);
  if (q.window === "overdue") items = items.filter((i) => i.daysRemaining < 0);
  else if (q.window && /^\d+$/.test(q.window)) items = items.filter((i) => i.daysRemaining >= 0 && i.daysRemaining <= Number(q.window));
  return { generatedAt: isoTime(now), items: items.slice(0, 500).map((i) => itemView(i, canBilling)), total: items.length };
}

export async function subscriptionsList(canBilling: boolean) {
  const assets = await loadActiveAssets();
  return assets.flatMap((a) =>
    a.subscriptions.map((s) => ({
      id: s.id, assetId: a.id, assetName: a.name, assetType: a.type, client: CLIENT_NAME, provider: s.providerName ?? a.provider, kind: s.kind, label: s.label, cycle: s.cycle, customIntervalMonths: s.customIntervalMonths,
      autoRenew: s.autoRenew, lastPaymentDate: isoDate(s.lastPaymentDate), nextDueDate: isoDate(s.nextDueDate), renewalDate: isoDate(s.renewalDate), expirationDate: isoDate(s.expirationDate),
      dateSources: s.fieldSources && typeof s.fieldSources === "object" ? Object.fromEntries(Object.entries(s.fieldSources as Record<string, unknown>).filter(([k]) => k !== "anchorDay")) : {},
      ...(canBilling ? { currency: s.currency, amount: s.amount, paymentStatus: s.paymentStatus, invoiceRef: s.invoiceRef, billingAccount: s.billingAccount, notes: s.notes } : { billingHidden: true }),
    })),
  );
}

/* ------------------------------------------------------------ dashboard */

export async function dashboard(canBilling: boolean) {
  const now = new Date();
  const today = startOfUtcDay(now);
  const assets = await loadActiveAssets();
  const rows = asRows(assets);
  const items = buildRenewalItems(rows, now);
  const alertsByAsset = await openAlertCounts(assets.map((a) => new Types.ObjectId(a.id)));
  const [connections, alerts, runs, alertCount] = await Promise.all([
    InfraProviderConnection.find({ disconnectedAt: null }).select("provider label status lastSyncAt lastError").lean<any[]>(),
    InfraAlert.find({ state: { $in: ["OPEN", "ACKNOWLEDGED"] } }).sort({ raisedAt: -1 }).limit(8).lean<any[]>(),
    InfraSyncRun.find({}).sort({ startedAt: -1 }).limit(10).lean<any[]>(),
    InfraAlert.countDocuments({ state: "OPEN" }),
  ]);
  const assetBy = new Map(assets.map((a) => [a.id, a]));

  const verified = items.filter((i) => i.source !== "projected");
  const within = (n: number) => verified.filter((i) => i.daysRemaining >= 0 && i.daysRemaining <= n).length;
  const servers = assets.filter((a) => a.type === "SERVER");
  const domains = assets.filter((a) => a.type === "DOMAIN");
  const certs = assets.flatMap((a) => a.certificates);
  const hosting = assets.flatMap((a) => a.subscriptions).filter((s) => s.kind === "SERVER" || s.kind === "HOSTING");

  // Domain expiry timeline: next 12 months, by month.
  const timeline: Array<{ month: string; count: number }> = [];
  for (let m = 0; m < 12; m += 1) {
    const start = utcDate(today.getUTCFullYear(), today.getUTCMonth() + m, 1);
    const end = utcDate(today.getUTCFullYear(), today.getUTCMonth() + m + 1, 1);
    timeline.push({ month: start.toISOString().slice(0, 7), count: items.filter((i) => i.kind === "domain_expiry" && i.date >= start && i.date < end).length });
  }

  const providerCounts = new Map<string, number>();
  for (const s of servers) providerCounts.set(s.provider ?? "unspecified", (providerCounts.get(s.provider ?? "unspecified") ?? 0) + 1);
  const shared = { name: CLIENT_NAME, servers: 0, domains: 0, certificates: 0, monthly: new Map<string, number>() };
  for (const a of assets) {
    if (a.type === "SERVER") shared.servers += 1;
    if (a.type === "DOMAIN") shared.domains += 1;
    shared.certificates += a.certificates.length;
  }
  const byClient = new Map([["shared", shared]]);

  const result: Record<string, unknown> = {
    generatedAt: isoTime(now),
    totals: {
      servers: servers.length, domains: domains.length, sslCertificates: certs.length, hostingSubscriptions: hosting.length,
      connectedProviders: connections.filter((c) => c.status === "CONNECTED").length, expiringWithin7Days: within(7), expiringWithin30Days: within(30),
      overdueOrExpired: verified.filter((i) => i.daysRemaining < 0).length, unknownRenewalDates: unknownRenewalAssets(rows, items).length, openAlerts: alertCount,
      runningServers: servers.filter((s) => (s.server?.providerStatus ?? "").toLowerCase() === "running").length,
      monitoredServers: servers.filter((s) => ["online", "stale"].includes(collectorStateOf(s.collector, now))).length,
      serversNeedingAttention: servers.filter((s) => (alertsByAsset.get(s.id) ?? 0) > 0 || collectorStateOf(s.collector, now) === "offline").length,
    },
    upcoming: verified.filter((i) => i.daysRemaining >= -30 && i.kind !== "ssl_expiry").slice(0, 12).map((i) => itemView(i, canBilling)),
    domainExpiryTimeline: timeline,
    serverDistribution: {
      byProvider: [...providerCounts.entries()].map(([provider, count]) => ({ provider, count })).sort((a, b) => b.count - a.count),
      byEnvironment: ["PRODUCTION", "STAGING", "DEVELOPMENT", "OTHER"].map((env) => ({ environment: env, count: assets.filter((a) => a.environment === env).length })),
    },
    inventory: { total: assets.length, imported: assets.filter((a) => a.providerConnectionId).length, manual: assets.filter((a) => !a.providerConnectionId).length },
    alerts: alerts.map((a) => {
      const asset = assetBy.get(sid(a.assetId));
      return { id: sid(a._id), kind: a.kind, state: a.state, severity: a.severity, title: a.title, raisedAt: isoTime(a.raisedAt), asset: asset ? { id: asset.id, name: asset.name, type: asset.type } : null };
    }),
    recentSync: runs.map((r) => ({ id: sid(r._id), kind: r.kind, status: r.status, trigger: r.trigger, startedAt: isoTime(r.startedAt), finishedAt: isoTime(r.finishedAt), error: r.error ?? null })),
    failedChecks: [
      ...domains.filter((d) => d.domain && ["ERROR", "RATE_LIMITED", "RESTRICTED"].includes(d.domain.rdapState)).map((d) => ({ assetId: d.id, name: d.name, check: "Registration lookup", detail: d.domain!.rdapError })),
      ...domains.filter((d) => d.domain && ["ERROR", "PARTIAL"].includes(d.domain.dnsState)).map((d) => ({ assetId: d.id, name: d.name, check: "DNS lookup", detail: d.domain!.dnsError })),
      ...assets.flatMap((a) => a.certificates.filter((c) => c.lastError).map((c) => ({ assetId: a.id, name: c.hostname, check: "SSL check", detail: c.lastError }))),
      ...connections.filter((c) => c.status === "AUTH_FAILED" || c.status === "ERROR").map((c) => ({ assetId: null, name: c.label, check: "Provider sync", detail: c.lastError ?? null })),
    ].slice(0, 15),
    certificateStates: certs.reduce<Record<string, number>>((acc, c) => { const s = c.lastCheckedAt ? certificateState(c.validTo, now).state : "UNKNOWN"; acc[s] = (acc[s] ?? 0) + 1; return acc; }, {}),
  };

  if (canBilling) result.billing = billingSummary(assets, now, byClient);
  result.byClient = [...byClient.entries()].map(([id, v]) => ({ clientId: id === "shared" ? null : id, name: v.name, servers: v.servers, domains: v.domains, certificates: v.certificates, monthlyCost: canBilling ? currencyRows(v.monthly) : null }));
  return result;
}

function billingSummary(assets: LoadedAsset[], now: Date, byClient: Map<string, { monthly: Map<string, number> }>) {
  const monthly = new Map<string, number>();
  const byProvider = new Map<string, Map<string, number>>();
  const upcoming30 = new Map<string, number>();
  const excluded = { unknownAmount: 0, unknownCycle: 0, unknownNextDue: 0 };
  const months: Array<{ month: string; totals: Map<string, number> }> = [];
  const start = utcDate(now.getUTCFullYear(), now.getUTCMonth(), 1);
  for (let i = 0; i < 12; i += 1) months.push({ month: utcDate(start.getUTCFullYear(), start.getUTCMonth() + i, 1).toISOString().slice(0, 7), totals: new Map() });
  const horizon = utcDate(start.getUTCFullYear(), start.getUTCMonth() + 12, 0);
  const today = startOfUtcDay(now);
  const in30 = new Date(today.getTime() + 30 * 86_400_000);

  for (const a of assets) {
    for (const s of a.subscriptions) {
      const amount = s.amount === null ? null : Number(s.amount);
      if (amount === null) { excluded.unknownAmount += 1; continue; }
      const eq = monthlyEquivalent(amount, s.cycle as BillingCycle, s.customIntervalMonths);
      if (eq === null) { excluded.unknownCycle += 1; continue; }
      addTo(monthly, s.currency, eq);
      const p = a.provider ?? s.providerName ?? "unspecified";
      const pm = byProvider.get(p) ?? new Map<string, number>();
      addTo(pm, s.currency, eq);
      byProvider.set(p, pm);
      const cm = byClient.get("shared");
      if (cm) addTo(cm.monthly, s.currency, eq);
      if (!s.nextDueDate) { excluded.unknownNextDue += 1; continue; }
      // A projection from a known due date; payments are only ever confirmed through confirmPayment.
      const dates = projectOccurrences(s.nextDueDate, s.cycle as BillingCycle, s.customIntervalMonths, today, horizon, anchorDayOf(s.fieldSources));
      for (const d of dates) {
        const bucket = months.find((m) => m.month === d.toISOString().slice(0, 7));
        if (bucket) addTo(bucket.totals, s.currency, amount);
        if (d <= in30) addTo(upcoming30, s.currency, amount);
      }
    }
  }
  return {
    monthlyEquivalent: currencyRows(monthly),
    yearlyEquivalent: currencyRows(new Map([...monthly].map(([c, v]) => [c, Math.round(v * 12 * 100) / 100]))),
    upcomingPayments30Days: currencyRows(upcoming30),
    monthlyProjection: months.map((m) => ({ month: m.month, totals: currencyRows(m.totals) })),
    byProvider: [...byProvider.entries()].map(([provider, totals]) => ({ provider, monthly: currencyRows(totals) })),
    excluded,
    note: "Projections repeat each subscription from its confirmed next due date. Subscriptions without an amount, cycle or due date are excluded, never estimated.",
  };
}

export async function paymentHistory(months = 12) {
  const since = new Date(Date.now() - months * 31 * 86_400_000);
  const rows = await InfraBillingRecord.find({ kind: "PAYMENT", paidAt: { $gte: since } }).select("paidAt amount currency").lean<any[]>();
  const byMonth = new Map<string, Map<string, number>>();
  for (const r of rows) {
    const key = new Date(r.paidAt).toISOString().slice(0, 7);
    const m = byMonth.get(key) ?? new Map<string, number>();
    addTo(m, r.currency, money(r.amount) ?? 0);
    byMonth.set(key, m);
  }
  return [...byMonth.entries()].sort().map(([month, totals]) => ({ month, totals: currencyRows(totals) }));
}

export async function statusSummary() {
  const now = new Date();
  const assets = await loadActiveAssets();
  const rows = asRows(assets);
  const alerts = await openAlertCounts(assets.map((a) => new Types.ObjectId(a.id)));
  const items = buildRenewalItems(rows, now).filter((i) => i.verified && i.source !== "projected");

  const servers = assets.filter((a) => a.type === "SERVER");
  const status = (a: LoadedAsset) => (a.server?.providerStatus ?? "").toLowerCase();
  const running = servers.filter((a) => status(a) === "running");
  const DOWN = ["stopped", "offline", "shutdown", "shutdown_in_progress", "error", "unknown", "verification_required", "product_not_available", "uninstalled"];
  const problem = servers.filter((a) => a.server?.providerSuspended === true || DOWN.includes(status(a)));
  const notRunning = servers.filter((a) => a.server?.providerStatus && status(a) !== "running");
  const states = servers.map((a) => collectorStateOf(a.collector, now));
  const serverDue = items.filter((i) => servers.some((s) => s.id === i.assetId) && (i.kind === "payment_due" || i.kind === "service_expiry")).sort((a, b) => a.date.getTime() - b.date.getTime());
  const nextDue = serverDue.find((i) => i.daysRemaining >= 0) ?? serverDue[0] ?? null;
  const serverAlerts = servers.reduce((n, s) => n + (alerts.get(s.id) ?? 0), 0);
  const serverHealth = !servers.length ? "unknown" : problem.length || (nextDue && nextDue.daysRemaining < 0) ? "critical" : notRunning.length || states.includes("offline") || serverAlerts > 0 || (nextDue && nextDue.daysRemaining <= 7) ? "warning" : running.length ? "ok" : "unknown";

  const domains = assets.filter((a) => a.type === "DOMAIN");
  const dItems = items.filter((i) => i.kind === "domain_expiry").sort((a, b) => a.date.getTime() - b.date.getTime());
  const nearest = dItems[0] ?? null;
  const expired = dItems.filter((i) => i.daysRemaining < 0).length;
  const soon = dItems.filter((i) => i.daysRemaining >= 0 && i.daysRemaining <= 30).length;
  const certs = domains.flatMap((a) => a.certificates);
  const sslExpired = certs.filter((c) => c.lastCheckedAt && certificateState(c.validTo, now).state === "EXPIRED").length;
  const sslExpiring = certs.filter((c) => c.lastCheckedAt && certificateState(c.validTo, now).state === "EXPIRING").length;
  const domainHealth = !domains.length ? "unknown" : expired || sslExpired || (nearest && nearest.daysRemaining <= 7) ? "critical" : soon || sslExpiring ? "warning" : dItems.length ? "ok" : "unknown";

  const pick = (i: RenewalItem | null) => (i ? { name: i.assetName, date: isoDate(i.date), daysRemaining: i.daysRemaining, source: i.source, kind: i.kind } : null);
  return {
    generatedAt: isoTime(now),
    servers: {
      total: servers.length, running: running.length, notRunning: notRunning.slice(0, 5).map((a) => ({ name: a.name, status: a.server?.providerStatus ?? null })),
      monitored: states.filter((s) => s === "online" || s === "stale").length, collectorOffline: states.filter((s) => s === "offline").length, openAlerts: serverAlerts, health: serverHealth, nextDue: pick(nextDue),
    },
    domains: {
      total: domains.length, withKnownExpiry: dItems.length, unknownExpiry: domains.length - dItems.length, expired, expiringWithin30Days: soon, sslExpired, sslExpiring, health: domainHealth, nearest: pick(nearest),
    },
  };
}

/* ----------------------------------------------------------- fleet view */

/**
 * One row per server with provider status, monitoring state and (only when a fresh guest sample exists) CPU/memory/disk.
 * A server without a collector has null resource fields: "not monitored" is never presented as 0%.
 */
export async function fleet(q: Record<string, string | undefined>) {
  const now = new Date();
  const docs = await InfraAsset.find({ type: "SERVER", archivedAt: null }).limit(2000).lean<any[]>();
  const assets = await hydrateAssets(docs);
  const oids = assets.map((a) => new Types.ObjectId(a.id));
  const [sampleRows, alerts] = await Promise.all([
    oids.length ? InfraMetricSample.aggregate([{ $match: { assetId: { $in: oids }, ts: { $gte: new Date(now.getTime() - 30 * 60_000) } } }, { $sort: { assetId: 1, ts: -1 } }, { $group: { _id: "$assetId", doc: { $first: "$$ROOT" } } }]) : [],
    openAlertCounts(oids),
  ]);
  const latest = new Map<string, any>(sampleRows.map((r: any) => [sid(r._id), r.doc]));
  const items = buildRenewalItems(asRows(assets), now).filter((i) => i.kind !== "ssl_expiry" && i.source !== "projected");
  const nextByAsset = new Map<string, RenewalItem>();
  for (const i of items) if (i.daysRemaining >= -30 && !nextByAsset.has(i.assetId)) nextByAsset.set(i.assetId, i);

  let rows = assets.map((a) => {
    const s = latest.get(a.id);
    const cs = collectorStateOf(a.collector, now);
    const fresh = Boolean(s && now.getTime() - new Date(s.ts).getTime() <= 3 * 60_000);
    const memPct = fresh && s.memTotalBytes ? (1 - Number(s.memAvailBytes ?? 0) / Number(s.memTotalBytes)) * 100 : null;
    const next = nextByAsset.get(a.id);
    return {
      id: a.id, name: a.name, technicalId: a.technicalId, environment: a.environment, provider: a.provider, imported: Boolean(a.providerConnectionId),
      client: null as string | null, clientId: null as string | null,
      providerStatus: a.server?.providerStatus ?? null, providerSuspended: a.server?.providerSuspended ?? null, region: a.server?.region ?? null, ipv4: a.server?.ipv4 ?? null, plan: a.server?.planName ?? null,
      vcpu: a.server?.vcpu ?? null, ramMb: a.server?.ramMb ?? null, storageGb: a.server?.storageGb ?? null, lastSyncedAt: isoTime(a.server?.lastSyncedAt), syncState: a.server?.syncState ?? null,
      monitoring: cs, cpuPct: fresh ? s.cpuPct ?? null : null, memPct, diskPct: fresh ? s.diskMaxUsedPct ?? null : null,
      lastMetricsAt: isoTime(a.collector?.lastSampleAt ?? null), openAlerts: alerts.get(a.id) ?? 0,
      nextRenewal: next ? { date: isoDate(next.date), daysRemaining: next.daysRemaining, kind: next.kind } : null,
    };
  });
  type Row = (typeof rows)[number];
  const pressured = (r: Row) => r.openAlerts > 0 || r.monitoring === "offline" || (r.cpuPct ?? 0) >= 85 || (r.memPct ?? 0) >= 90 || (r.diskPct ?? 0) >= 85;

  // Summary is computed before filters, so the cards always describe the whole fleet.
  const count = (fn: (r: Row) => boolean) => rows.filter(fn).length;
  const tally = (key: (r: Row) => string) => {
    const m = new Map<string, number>();
    for (const r of rows) m.set(key(r), (m.get(key(r)) ?? 0) + 1);
    return [...m.entries()].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value);
  };
  const status = (r: Row) => (r.providerStatus ?? "").toLowerCase();
  const summary = {
    total: rows.length,
    running: count((r) => status(r) === "running"),
    stopped: count((r) => ["stopped", "offline", "shutdown"].includes(status(r))),
    otherStatus: count((r) => r.providerStatus !== null && !["running", "stopped", "offline", "shutdown"].includes(status(r))),
    noStatus: count((r) => r.providerStatus === null),
    monitored: count((r) => r.monitoring === "online" || r.monitoring === "stale"),
    pendingSetup: count((r) => r.monitoring === "pending"),
    unmonitored: count((r) => r.monitoring === "not_configured" || r.monitoring === "revoked"),
    collectorOffline: count((r) => r.monitoring === "offline"),
    needingAttention: count(pressured),
    cpuPressure: count((r) => (r.cpuPct ?? 0) >= 85),
    memoryPressure: count((r) => (r.memPct ?? 0) >= 90),
    diskPressure: count((r) => (r.diskPct ?? 0) >= 85),
    renewalsWithin30Days: count((r) => r.nextRenewal !== null && r.nextRenewal.daysRemaining >= 0 && r.nextRenewal.daysRemaining <= 30),
    byProvider: tally((r) => r.provider ?? "unspecified"),
    byRegion: tally((r) => r.region ?? "Not reported"),
    byStatus: tally((r) => r.providerStatus ?? "Not reported"),
  };

  const term = q.q?.trim().toLowerCase();
  if (term) rows = rows.filter((r) => [r.name, r.technicalId, r.ipv4, r.provider, r.region, r.client].some((v) => v?.toLowerCase().includes(term)));
  if (q.provider) rows = rows.filter((r) => (r.provider ?? "unspecified") === q.provider);
  if (q.environment) rows = rows.filter((r) => r.environment === q.environment);
  if (q.clientId) rows = rows.filter((r) => (q.clientId === "shared" ? r.clientId === null : r.clientId === q.clientId));
  if (q.status) rows = rows.filter((r) => (r.providerStatus ?? "none").toLowerCase() === q.status!.toLowerCase());
  if (q.monitoring === "monitored") rows = rows.filter((r) => r.monitoring === "online" || r.monitoring === "stale");
  else if (q.monitoring === "unmonitored") rows = rows.filter((r) => r.monitoring === "not_configured" || r.monitoring === "revoked");
  else if (q.monitoring === "offline") rows = rows.filter((r) => r.monitoring === "offline");
  if (q.attention === "true") rows = rows.filter(pressured);

  const nullsLast = (get: (r: Row) => number | null, dir: 1 | -1) => (a: Row, b: Row) => {
    const x = get(a);
    const y = get(b);
    if (x === null && y === null) return a.name.localeCompare(b.name);
    if (x === null) return 1;
    if (y === null) return -1;
    return (x - y) * dir || a.name.localeCompare(b.name);
  };
  const byName = (a: Row, b: Row) => a.name.localeCompare(b.name);
  const sorters: Record<string, (a: Row, b: Row) => number> = {
    name: byName, "-cpu": nullsLast((r) => r.cpuPct, -1), "-memory": nullsLast((r) => r.memPct, -1), "-disk": nullsLast((r) => r.diskPct, -1),
    "-alerts": (a, b) => b.openAlerts - a.openAlerts || byName(a, b), renewal: nullsLast((r) => r.nextRenewal?.daysRemaining ?? null, 1),
  };
  rows.sort(sorters[q.sort ?? "name"] ?? byName);
  const page = Math.max(1, Number(q.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(q.limit) || 20));
  return { summary, items: rows.slice((page - 1) * limit, page * limit), total: rows.length, page, limit };
}

/* ------------------------------------------------------ domain analytics */

/** Every series here is computed from stored rows/events: registrations, check history and certificate state. */
export async function domainAnalytics() {
  const now = new Date();
  const docs = await InfraAsset.find({ type: "DOMAIN", archivedAt: null }).limit(5000).lean<any[]>();
  const assets = await hydrateAssets(docs);
  const items = buildRenewalItems(asRows(assets), now).filter((i) => i.kind === "domain_expiry");
  const bucket = (lo: number, hi: number) => items.filter((i) => i.daysRemaining >= lo && i.daysRemaining <= hi).length;
  const expiryWindows = [
    { label: "Expired", value: items.filter((i) => i.daysRemaining < 0).length },
    { label: "0–7 days", value: bucket(0, 7) },
    { label: "8–30 days", value: bucket(8, 30) },
    { label: "31–90 days", value: bucket(31, 90) },
    { label: "91–180 days", value: bucket(91, 180) },
    { label: "181–365 days", value: bucket(181, 365) },
    { label: "> 1 year", value: items.filter((i) => i.daysRemaining > 365).length },
  ];
  const registrars = new Map<string, number>();
  for (const a of assets) {
    const key = a.domain?.registrar ?? "Unknown";
    registrars.set(key, (registrars.get(key) ?? 0) + 1);
  }
  // Portfolio growth: cumulative count by month of addition (last 12 months).
  const growth: Array<{ month: string; added: number; total: number }> = [];
  for (let m = 11; m >= 0; m -= 1) {
    const start = utcDate(now.getUTCFullYear(), now.getUTCMonth() - m, 1);
    const end = utcDate(now.getUTCFullYear(), now.getUTCMonth() - m + 1, 1);
    growth.push({ month: start.toISOString().slice(0, 7), added: assets.filter((a) => a.createdAt >= start && a.createdAt < end).length, total: assets.filter((a) => a.createdAt < end).length });
  }
  const ids = docs.map((d) => d._id);
  const since = new Date(now.getTime() - 14 * 86_400_000);
  const runs = ids.length ? await InfraSyncRun.find({ assetId: { $in: ids }, kind: { $in: ["DNS", "RDAP"] }, startedAt: { $gte: since } }).select("kind status startedAt").lean<any[]>() : [];
  const days: Array<{ day: string; dnsOk: number; dnsFailed: number; rdapOk: number; rdapFailed: number }> = [];
  for (let d = 13; d >= 0; d -= 1) {
    const day = new Date(now.getTime() - d * 86_400_000).toISOString().slice(0, 10);
    const inDay = runs.filter((r) => new Date(r.startedAt).toISOString().slice(0, 10) === day);
    const ok = (k: string) => inDay.filter((r) => r.kind === k && r.status !== "FAILED").length;
    const bad = (k: string) => inDay.filter((r) => r.kind === k && r.status === "FAILED").length;
    days.push({ day, dnsOk: ok("DNS"), dnsFailed: bad("DNS"), rdapOk: ok("RDAP"), rdapFailed: bad("RDAP") });
  }
  const dnsChanges = ids.length ? await InfraDnsSnapshot.find({ domainId: { $in: ids }, changed: true, checkedAt: { $gte: new Date(now.getTime() - 90 * 86_400_000) } }).sort({ checkedAt: -1 }).limit(40).select("domainId checkedAt changes").lean<any[]>() : [];
  const nameOf = new Map(assets.map((a) => [a.id, a.name]));
  const certStates: Record<string, number> = { VALID: 0, EXPIRING: 0, EXPIRED: 0, UNKNOWN: 0 };
  for (const c of assets.flatMap((a) => a.certificates)) {
    const st = c.lastCheckedAt ? certificateState(c.validTo, now).state : "UNKNOWN";
    certStates[st] = (certStates[st] ?? 0) + 1;
  }
  return {
    totals: { domains: assets.length, withKnownExpiry: items.length, unknownExpiry: assets.length - items.length, dnssecSigned: assets.filter((a) => a.domain?.dnssec === true).length, dnssecUnsigned: assets.filter((a) => a.domain?.dnssec === false).length },
    expiryWindows,
    registrars: [...registrars.entries()].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value),
    portfolioGrowth: growth,
    checkHistory: days,
    dnsChanges: dnsChanges.map((c) => ({ id: sid(c._id), assetId: sid(c.domainId), domain: nameOf.get(sid(c.domainId)) ?? "", at: isoTime(c.checkedAt), types: ((c.changes ?? []) as Array<{ type: string }>).map((x) => x.type) })),
    certificates: certStates,
  };
}

/* -------------------------------------------------------------- exports */

export async function exportCsv(what: "domains" | "servers" | "renewals", canBilling: boolean): Promise<string> {
  const assets = await loadActiveAssets();
  const now = new Date();
  if (what === "domains") {
    return toCsv(
      ["Domain", "Client", "Environment", "Registrar", "Registered", "Registry expiry", "Effective expiry", "Expiry source", "Days remaining", "Nameservers", "DNSSEC", "RDAP state", "Last checked"],
      assets.filter((a) => a.domain).map((a) => {
        const eff = effectiveDomainExpiry(a.domain, a.subscriptions as never);
        return [a.technicalId, CLIENT_NAME, a.environment, a.domain!.registrar, isoDate(a.domain!.registeredAt), isoDate(a.domain!.registryExpiresAt), isoDate(eff.date), eff.source, eff.date ? Math.round((eff.date.getTime() - startOfUtcDay(now).getTime()) / 86_400_000) : "", a.domain!.nameservers.join(" "), a.domain!.dnssec === null ? "" : a.domain!.dnssec ? "signed" : "unsigned", a.domain!.rdapState, isoTime(a.domain!.rdapCheckedAt)];
      }),
    );
  }
  if (what === "servers") {
    return toCsv(
      ["Name", "Client", "Provider", "Environment", "Type", "Plan", "Hostname", "IPv4", "IPv6", "Region", "OS", "vCPU", "RAM (MB)", "Storage (GB)", "Provider status", "Source", "Last synced"],
      assets.filter((a) => a.server).map((a) => [a.name, CLIENT_NAME, a.provider, a.environment, a.server!.serverType, a.server!.planName, a.server!.hostname, a.server!.ipv4, a.server!.ipv6, a.server!.region, a.server!.operatingSystem, a.server!.vcpu, a.server!.ramMb, a.server!.storageGb, a.server!.providerStatus, a.providerConnectionId ? "provider API" : "manual", isoTime(a.server!.lastSyncedAt)]),
    );
  }
  const items = buildRenewalItems(asRows(assets), now);
  return toCsv(
    ["Asset", "Type", "What", "Date", "Days remaining", "Source", "Verified", ...(canBilling ? ["Amount", "Currency", "Payment status"] : [])],
    items.map((i) => [i.assetName, i.assetType, i.kind.replace("_", " "), isoDate(i.date), i.daysRemaining, i.source, i.verified ? "yes" : "no", ...(canBilling ? [i.amount, i.currency, i.paymentStatus] : [])]),
  );
}
