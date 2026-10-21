import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { Types } from "mongoose";
import { InfraAlert, InfraAsset, InfraCollector, InfraMetricSample } from "../../models/infrastructure/infrastructure.models";
import { logger } from "../../utils/logger";
import { buildRenewalItems } from "./core/renewal-items";
import {
  COLLECTOR_OFFLINE_MS, DEFAULT_THRESHOLDS, MIN_SAMPLE_INTERVAL_MS, RANGES, applySample, bucketSeconds, collectorState, computeHealth, deriveRates, instantLevels, memUsedPct, parsePush,
  type CollectorReport, type Counters, type RangeKey, type RuleKey, type RuleStates, type Thresholds,
} from "./core/server-metrics";
import { raiseEvent } from "./infra.alerts";
import { asRows, getSettingsDoc, hydrateAssets, upsertSettings } from "./infra.data";
import { audit, E, errMsg, INFRA_ACTIONS, INFRA_RESOURCE, isoDate, isoTime, oid, sid, type InfraActor } from "./infra.util";

const TOKEN_PREFIX = "omi_col_";
const hash = (token: string) => createHash("sha256").update(token).digest("hex");

const THRESHOLD_BOUNDS: Record<keyof Thresholds, [number, number]> = {
  cpuPct: [20, 100], memPct: [20, 100], diskWarnPct: [20, 99], diskCritPct: [30, 100], swapPct: [5, 100], netErrPerSec: [0.1, 100_000],
  sustainSamples: [1, 60], recoverSamples: [1, 60], containerRestarts: [1, 100],
};

const RULE_LABEL: Record<RuleKey, string> = { cpu: "CPU", memory: "Memory", disk: "Disk", swap: "Swap", network_errors: "Network errors", container_restarts: "Container restarts" };

/* ------------------------------------------------------------ thresholds */

export async function getThresholds(): Promise<Thresholds> {
  const raw = ((await getSettingsDoc())?.metricThresholds ?? {}) as Record<string, unknown>;
  const out: Thresholds = { ...DEFAULT_THRESHOLDS };
  for (const k of Object.keys(THRESHOLD_BOUNDS) as Array<keyof Thresholds>) {
    const v = raw[k];
    const [lo, hi] = THRESHOLD_BOUNDS[k];
    if (typeof v === "number" && Number.isFinite(v) && v >= lo && v <= hi) out[k] = v;
  }
  return out;
}

export async function updateThresholds(actor: InfraActor, input: Record<string, unknown>) {
  const clean: Record<string, number> = {};
  for (const [k, v] of Object.entries(input)) {
    const bounds = THRESHOLD_BOUNDS[k as keyof Thresholds];
    if (!bounds) throw E.badRequest(`Unknown threshold "${k}".`, "infra_unknown_threshold");
    if (typeof v !== "number" || !Number.isFinite(v) || v < bounds[0] || v > bounds[1]) throw E.badRequest(`${k} must be between ${bounds[0]} and ${bounds[1]}.`, "infra_invalid_threshold");
    clean[k] = v;
  }
  const merged = { ...(((await getSettingsDoc())?.metricThresholds ?? {}) as Record<string, number>), ...clean };
  if (merged.diskCritPct !== undefined && merged.diskWarnPct !== undefined && merged.diskCritPct <= merged.diskWarnPct) {
    throw E.badRequest("The critical disk threshold must be higher than the warning threshold.", "infra_invalid_threshold");
  }
  await upsertSettings({ metricThresholds: merged });
  await audit(actor, { action: INFRA_ACTIONS.SETTINGS_UPDATED, resourceType: INFRA_RESOURCE.ALERT, metadata: { fields: Object.keys(clean) } });
  return getThresholds();
}

/* -------------------------------------------------------------- collector */

async function serverOf(assetId: string) {
  const asset = await InfraAsset.findById(oid(assetId, "asset id")).select("type name archivedAt").lean<any>();
  if (!asset || asset.type !== "SERVER") throw E.notFound("Server not found.", "infra_asset_not_found");
  return asset;
}

/** Creates (or rotates) the collector credential. The plaintext token is returned exactly once and only its hash is stored. */
export async function createCollector(actor: InfraActor, assetId: string, label?: string) {
  const asset = await serverOf(assetId);
  const token = `${TOKEN_PREFIX}${randomBytes(32).toString("base64url")}`;
  const existing = await InfraCollector.findOne({ assetId: asset._id }).select("_id").lean<any>();
  const data = { tokenHash: hash(token), tokenHint: token.slice(-4), label: label?.slice(0, 120) ?? null, revokedAt: null, lastCounters: null, ruleState: null };
  if (existing) await InfraCollector.updateOne({ assetId: asset._id }, { $set: { ...data, rotatedAt: new Date() } });
  else await InfraCollector.create({ ...data, assetId: asset._id, createdByUserId: actor.userId });
  await audit(actor, { action: INFRA_ACTIONS.COLLECTOR_CREATED, resourceType: INFRA_RESOURCE.ASSET, resourceId: assetId, metadata: { rotated: Boolean(existing) } });
  return { token, ingestPath: "/api/v1/infrastructure/ingest", hint: token.slice(-4), rotated: Boolean(existing) };
}

export async function revokeCollector(actor: InfraActor, assetId: string) {
  const asset = await serverOf(assetId);
  const result = await InfraCollector.updateOne({ assetId: asset._id, revokedAt: null }, { $set: { revokedAt: new Date(), tokenHash: hash(randomBytes(16).toString("hex")), lastCounters: null } });
  if (!result.matchedCount) throw E.notFound("No active collector for this server.", "infra_collector_not_found");
  await audit(actor, { action: INFRA_ACTIONS.COLLECTOR_REVOKED, resourceType: INFRA_RESOURCE.ASSET, resourceId: assetId });
  return { revoked: true };
}

/* ----------------------------------------------------------------- ingest */

export async function ingest(authorization: string | undefined, body: unknown, now = new Date()) {
  const token = /^Bearer\s+(\S+)$/.exec(authorization ?? "")?.[1];
  if (!token || !token.startsWith(TOKEN_PREFIX) || token.length > 128) throw E.unauthorized("Invalid collector token.", "infra_collector_unauthorized");
  const row = await InfraCollector.findOne({ tokenHash: hash(token) }).lean<any>();
  const asset = row ? await InfraAsset.findById(row.assetId).select("name archivedAt type").lean<any>() : null;
  // Constant-time comparison of the stored hash guards against any early-exit timing difference.
  const ok = row && asset && !row.revokedAt && !asset.archivedAt && asset.type === "SERVER" && timingSafeEqual(Buffer.from(row.tokenHash), Buffer.from(hash(token)));
  if (!row || !asset || !ok) throw E.unauthorized("Invalid collector token.", "infra_collector_unauthorized");

  const parsed = parsePush(body, now);
  if (!parsed.ok) {
    await InfraCollector.updateOne({ _id: row._id }, { $inc: { rejectedCount: 1 } }).catch(() => undefined);
    throw E.badRequest(parsed.reason, "infra_invalid_sample");
  }
  const p = parsed.value;
  const last: Date | null = row.lastSampleAt ?? null;
  if (last && p.ts.getTime() - last.getTime() < MIN_SAMPLE_INTERVAL_MS && p.ts.getTime() >= last.getTime()) throw E.tooMany(`Push at most once every ${MIN_SAMPLE_INTERVAL_MS / 1000} seconds.`, "infra_too_frequent");
  if (last && p.ts.getTime() < last.getTime()) return { accepted: false, duplicate: true, reason: "older_than_latest" };

  const prevCounters = (row.lastCounters ?? null) as Counters | null;
  const rates = deriveRates(prevCounters, p.cumulative);
  const mem = p.memory;
  const diskMax = p.filesystems.length ? Math.max(...p.filesystems.map((f) => f.usedPct)) : null;
  const swapPct = mem && mem.swapTotalBytes && mem.swapUsedBytes !== null ? (mem.swapUsedBytes / mem.swapTotalBytes) * 100 : null;

  // Restart growth since the previous report (by container id): a rising counter is "restarting", a first sight is not.
  const prevReport = (row.latestReport ?? null) as CollectorReport | null;
  const prevRestarts = new Map((prevReport?.containers ?? []).map((c) => [c.id, c.restartCount ?? 0]));
  let maxDelta: number | null = null;
  if (prevReport) {
    for (const c of p.report.containers) {
      if (c.restartCount === null || !prevRestarts.has(c.id)) continue;
      const d = c.restartCount - (prevRestarts.get(c.id) ?? 0);
      maxDelta = Math.max(maxDelta ?? 0, Math.max(0, d));
    }
  }

  try {
    await InfraMetricSample.create({
      assetId: row.assetId, ts: p.ts,
      cpuPct: rates.cpuPct, cpuUserPct: rates.cpuUserPct, cpuSystemPct: rates.cpuSystemPct, cpuIowaitPct: rates.cpuIowaitPct, cpuStealPct: rates.cpuStealPct,
      load1: p.load?.[0] ?? null, load5: p.load?.[1] ?? null, load15: p.load?.[2] ?? null,
      memTotalBytes: mem?.totalBytes ?? null, memAvailBytes: mem?.availableBytes ?? null, memCachedBytes: mem?.cachedBytes ?? null,
      swapTotalBytes: mem?.swapTotalBytes ?? null, swapUsedBytes: mem?.swapUsedBytes ?? null,
      diskMaxUsedPct: diskMax, filesystems: p.filesystems.length ? p.filesystems : null,
      diskReadBps: rates.diskReadBps, diskWriteBps: rates.diskWriteBps, netRxBps: rates.netRxBps, netTxBps: rates.netTxBps, netErrPerSec: rates.netErrPerSec, netDropPerSec: rates.netDropPerSec,
      uptimeSec: p.uptimeSec,
    });
  } catch (e) {
    if ((e as { code?: number }).code === 11000) return { accepted: false, duplicate: true, reason: "duplicate_sample" };
    throw e;
  }

  const thresholds = await getThresholds();
  const levels = instantLevels({ cpuPct: rates.cpuPct, memUsedPct: memUsedPct(mem), swapUsedPct: swapPct, diskMaxUsedPct: diskMax, netErrPerSec: rates.netErrPerSec, maxContainerRestartDelta: maxDelta }, thresholds);
  // A counter reset (reboot / agent restart) yields no rate for that interval; it must not count as healthy or unhealthy.
  if (rates.counterReset) { levels.cpu = null; levels.network_errors = null; }
  const { state, transitions } = applySample((row.ruleState ?? {}) as RuleStates, levels, thresholds, p.ts);

  await InfraCollector.updateOne({ _id: row._id }, {
    $set: { lastSeenAt: now, lastSampleAt: p.ts, agentVersion: p.agentVersion ?? row.agentVersion, hostFacts: p.host ?? row.hostFacts ?? null, latestReport: p.report, lastCounters: p.cumulative, ruleState: state },
  });

  // The collector is talking again: any open "collector offline" alert for this server is over.
  await InfraAlert.updateMany({ assetId: row.assetId, kind: "COLLECTOR_OFFLINE", state: { $in: ["OPEN", "ACKNOWLEDGED", "SNOOZED"] } }, { $set: { state: "RESOLVED", resolvedAt: now } });

  for (const tr of transitions) {
    const key = `RESOURCE_PRESSURE:${sid(row.assetId)}:${tr.rule}:${tr.openedAt}`.slice(0, 200);
    if (tr.type === "recover") {
      await InfraAlert.updateMany({ dedupeKey: key, state: { $ne: "RESOLVED" } }, { $set: { state: "RESOLVED", resolvedAt: now } });
      continue;
    }
    if (tr.type === "escalate") {
      await InfraAlert.updateMany({ dedupeKey: key }, { $set: { severity: "critical" } });
      continue;
    }
    // Messages carry numbers only: never hostnames, mounts or process details.
    await raiseEvent({
      assetId: sid(row.assetId), kind: "RESOURCE_PRESSURE", severity: tr.severity === "critical" ? "critical" : "warning", dedupeKey: key,
      title: `${RULE_LABEL[tr.rule]} pressure on ${asset.name}`,
      message: `${RULE_LABEL[tr.rule]} stayed above its threshold for ${thresholds.sustainSamples} consecutive samples on "${asset.name}". Open the server's Performance tab for the history.`,
    }).catch((e) => logger.warn(`infra.resource_alert_failed: ${errMsg(e, "unknown")}`));
  }
  return { accepted: true, duplicate: false, counterReset: rates.counterReset, rulesOpened: transitions.filter((x) => x.type === "open").map((x) => x.rule) };
}

/* ------------------------------------------------------------------ views */

export async function monitoringStatus(assetId: string, canBillingDates = true) {
  const asset = await serverOf(assetId);
  const now = new Date();
  const [collector, latest, full, thresholds] = await Promise.all([
    InfraCollector.findOne({ assetId: asset._id }).lean<any>(),
    InfraMetricSample.findOne({ assetId: asset._id }).sort({ ts: -1 }).lean<any>(),
    InfraAsset.findById(asset._id).lean<any>(),
    getThresholds(),
  ]);
  const [loaded] = await hydrateAssets([full]);
  const server = loaded.server;
  const items = buildRenewalItems(asRows([loaded]), now).filter((i) => i.kind !== "ssl_expiry" && i.source !== "projected");
  const nextBilling = items.filter((i) => i.daysRemaining >= 0).sort((a, b) => a.daysRemaining - b.daysRemaining)[0] ?? null;
  const overdue = items.some((i) => i.daysRemaining < 0);
  const report = (collector?.latestReport ?? null) as CollectorReport | null;
  const sampleView = latest
    ? {
        cpuPct: latest.cpuPct ?? null,
        memUsedPct: latest.memTotalBytes ? memUsedPct({ totalBytes: Number(latest.memTotalBytes), availableBytes: Number(latest.memAvailBytes ?? 0) }) : null,
        swapUsedPct: latest.swapTotalBytes && latest.swapUsedBytes !== null && latest.swapUsedBytes !== undefined ? (Number(latest.swapUsedBytes) / Number(latest.swapTotalBytes)) * 100 : null,
        diskMaxUsedPct: latest.diskMaxUsedPct ?? null,
        netErrPerSec: latest.netErrPerSec ?? null,
        maxContainerRestartDelta: null,
      }
    : null;
  const health = computeHealth({
    now, providerStatus: server?.providerStatus ?? null, providerSuspended: server?.providerSuspended ?? null,
    hasCollector: Boolean(collector), collectorRevoked: Boolean(collector?.revokedAt), lastSampleAt: collector?.lastSampleAt ?? null,
    latest: sampleView, rules: (collector?.ruleState ?? {}) as RuleStates, thresholds,
    unhealthyServices: report ? report.services.filter((s) => !["active", "running", "enabled"].includes(s.state)).length : null,
    restartingContainers: report ? report.containers.filter((c) => c.state === "restarting").length : null,
    billingDaysRemaining: nextBilling?.daysRemaining ?? null, billingOverdue: overdue,
  });
  const openAlerts = await InfraAlert.find({ assetId: asset._id, state: { $in: ["OPEN", "ACKNOWLEDGED"] } }).sort({ raisedAt: -1 }).limit(10).select("kind state severity title raisedAt").lean<any[]>();
  const n = (v: unknown) => (v === null || v === undefined ? null : Number(v));
  return {
    assetId,
    collector: collector
      ? {
          configured: !collector.revokedAt, revoked: Boolean(collector.revokedAt), tokenHint: collector.tokenHint, label: collector.label ?? null, agentVersion: collector.agentVersion ?? null,
          createdAt: isoTime(collector.createdAt), rotatedAt: isoTime(collector.rotatedAt), lastSeenAt: isoTime(collector.lastSeenAt), lastSampleAt: isoTime(collector.lastSampleAt),
          rejectedSamples: collector.rejectedCount ?? 0, sampleAgeSeconds: collector.lastSampleAt ? Math.round((now.getTime() - new Date(collector.lastSampleAt).getTime()) / 1000) : null,
        }
      : null,
    state: collectorState({ now, hasCollector: Boolean(collector), collectorRevoked: Boolean(collector?.revokedAt), lastSampleAt: collector?.lastSampleAt ?? null }),
    host: collector?.hostFacts ?? null,
    latest: latest
      ? {
          at: isoTime(latest.ts), cpuPct: n(latest.cpuPct), cpuUserPct: n(latest.cpuUserPct), cpuSystemPct: n(latest.cpuSystemPct), cpuIowaitPct: n(latest.cpuIowaitPct), cpuStealPct: n(latest.cpuStealPct),
          load: [n(latest.load1), n(latest.load5), n(latest.load15)],
          memTotalBytes: n(latest.memTotalBytes), memAvailBytes: n(latest.memAvailBytes), memCachedBytes: n(latest.memCachedBytes), swapTotalBytes: n(latest.swapTotalBytes), swapUsedBytes: n(latest.swapUsedBytes),
          memUsedPct: sampleView?.memUsedPct ?? null, swapUsedPct: sampleView?.swapUsedPct ?? null, diskMaxUsedPct: n(latest.diskMaxUsedPct), filesystems: latest.filesystems ?? [],
          diskReadBps: n(latest.diskReadBps), diskWriteBps: n(latest.diskWriteBps), netRxBps: n(latest.netRxBps), netTxBps: n(latest.netTxBps), netErrPerSec: n(latest.netErrPerSec), netDropPerSec: n(latest.netDropPerSec),
          uptimeSec: n(latest.uptimeSec),
        }
      : null,
    report: report ?? null,
    health,
    thresholds,
    alerts: openAlerts.map((a) => ({ id: sid(a._id), kind: a.kind, state: a.state, severity: a.severity, title: a.title, raisedAt: isoTime(a.raisedAt) })),
    nextBilling: nextBilling ? { date: isoDate(nextBilling.date), daysRemaining: nextBilling.daysRemaining, kind: nextBilling.kind, verified: nextBilling.verified } : null,
    canBillingDates,
  };
}

const AVG_KEYS: Array<[string, string]> = [
  ["cpuAvg", "cpuPct"], ["cpuUser", "cpuUserPct"], ["cpuSystem", "cpuSystemPct"], ["cpuIowait", "cpuIowaitPct"], ["load1", "load1"], ["load5", "load5"], ["load15", "load15"],
  ["diskAvg", "diskMaxUsedPct"], ["diskRead", "diskReadBps"], ["diskWrite", "diskWriteBps"], ["netRx", "netRxBps"], ["netTx", "netTxBps"], ["netErr", "netErrPerSec"], ["netDrop", "netDropPerSec"],
];
const MAX_KEYS: Array<[string, string]> = [["cpuMax", "cpuPct"], ["load1Max", "load1"], ["diskMax", "diskMaxUsedPct"], ["netRxMax", "netRxBps"], ["netTxMax", "netTxBps"]];

/** Bucketed series for a set of servers. Missing buckets are returned as explicit gaps (null) so an outage shows as a break. */
async function bucketed(range: RangeKey, assetMatch: Record<string, unknown>) {
  const seconds = bucketSeconds(range);
  const since = new Date(Date.now() - RANGES[range] * 1000);
  const memPct = { $cond: [{ $gt: ["$memTotalBytes", 0] }, { $multiply: [100, { $divide: [{ $subtract: ["$memTotalBytes", "$memAvailBytes"] }, "$memTotalBytes"] }] }, null] };
  const swapPct = { $cond: [{ $gt: ["$swapTotalBytes", 0] }, { $multiply: [100, { $divide: ["$swapUsedBytes", "$swapTotalBytes"] }] }, null] };
  const group: any = { _id: "$bucket", samples: { $sum: 1 } };
  for (const [out, field] of AVG_KEYS) group[out] = { $avg: `$${field}` };
  for (const [out, field] of MAX_KEYS) group[out] = { $max: `$${field}` };
  group.memAvg = { $avg: "$memPct" };
  group.memMax = { $max: "$memPct" };
  group.swapAvg = { $avg: "$swapPct" };
  const rows = await InfraMetricSample.aggregate([
    { $match: { ...assetMatch, ts: { $gte: since } } },
    { $addFields: { bucket: { $multiply: [{ $floor: { $divide: [{ $toLong: "$ts" }, seconds * 1000] } }, seconds] }, memPct, swapPct } },
    { $group: group },
    { $sort: { _id: 1 } },
  ]);
  const byBucket = new Map<number, Record<string, number | null>>(rows.map((r: any) => [Number(r._id), r]));
  const start = Math.floor(since.getTime() / 1000 / seconds) * seconds;
  const end = Math.floor(Date.now() / 1000 / seconds) * seconds;
  const points: Array<Record<string, number | null>> = [];
  const keys = ["cpuAvg", "cpuMax", "cpuUser", "cpuSystem", "cpuIowait", "memAvg", "memMax", "swapAvg", "load1", "load1Max", "load5", "load15", "diskAvg", "diskMax", "diskRead", "diskWrite", "netRx", "netTx", "netRxMax", "netTxMax", "netErr", "netDrop"];
  for (let b = start; b <= end; b += seconds) {
    const r = byBucket.get(b);
    const point: Record<string, number | null> = { t: b * 1000, samples: r ? Number(r.samples) : 0 };
    for (const k of keys) point[k] = r && r[k] !== null && r[k] !== undefined ? Number(r[k]) : null;
    points.push(point);
  }
  return { range, bucketSeconds: seconds, from: since.toISOString(), points, bucketsWithData: rows.length, bucketsTotal: points.length };
}

export async function assetMetrics(assetId: string, range: RangeKey) {
  const asset = await serverOf(assetId);
  return bucketed(range, { assetId: asset._id });
}

/** Fleet trend over every monitored (non-revoked collector) server. */
export async function fleetMetrics(range: RangeKey) {
  const collectors = await InfraCollector.find({ revokedAt: null }).select("assetId").lean<any[]>();
  const live = collectors.length ? await InfraAsset.find({ _id: { $in: collectors.map((c) => c.assetId) }, type: "SERVER", archivedAt: null }).select("_id").lean<any[]>() : [];
  const ids = live.map((a) => a._id as Types.ObjectId);
  if (!ids.length) return { range, bucketSeconds: bucketSeconds(range), serversReporting: 0, points: [] as Array<Record<string, number | null>> };
  return { ...(await bucketed(range, { assetId: { $in: ids } })), serversReporting: ids.length };
}

/** Raises "collector offline" once per silence. (Metric retention is a TTL index on the samples collection.) */
export async function sweepMonitoring(now = new Date()) {
  const cutoff = new Date(now.getTime() - COLLECTOR_OFFLINE_MS);
  const silent = await InfraCollector.find({ revokedAt: null, lastSampleAt: { $ne: null, $lt: cutoff } }).select("assetId lastSampleAt").limit(200).lean<any[]>();
  let offline = 0;
  for (const c of silent) {
    const asset = await InfraAsset.findOne({ _id: c.assetId, archivedAt: null }).select("name").lean<any>();
    if (!asset) continue;
    const id = await raiseEvent({
      assetId: sid(c.assetId), kind: "COLLECTOR_OFFLINE", severity: "warning", dedupeKey: `COLLECTOR_OFFLINE:${sid(c.assetId)}:${new Date(c.lastSampleAt).toISOString()}`.slice(0, 200),
      title: `Monitoring collector offline: ${asset.name}`,
      message: `No metrics have been received from "${asset.name}" since ${new Date(c.lastSampleAt).toISOString()}. The server may still be running: check its provider status.`,
    }).catch(() => null);
    if (id) offline += 1;
  }
  return { offline, pruned: 0 };
}
