import { createHash, randomUUID } from "node:crypto";
import { InfraAsset, InfraDnsSnapshot, InfraLock, InfraProviderConnection, InfraSslCertificate } from "../../models/infrastructure/infrastructure.models";
import { logger } from "../../utils/logger";
import { evaluateAlerts } from "./infra.alerts";
import { ensureDefaultCertificate, refreshCertificate, refreshDns, refreshDomain, refreshRdap } from "./infra.intel";
import { sweepMonitoring } from "./infra.monitoring";
import { syncConnection } from "./infra.providers";
import { failStaleReports } from "./infra.report";
import { errMsg, mapLimit, sid } from "./infra.util";

/*
 * Background work (replaces the original BullMQ queue `infrastructure`).
 *
 * Redis availability in production is unverified, so work is scheduled from the application process and made safe for
 * several instances with a MongoDB lease lock (`infra_locks`): only the instance that atomically takes the lease runs
 * a sweep, and the lease expires on its own if that instance dies. External behaviour is the same: a repeating
 * `sweep` every INFRA_SWEEP_MINUTES that performs only due work, and de-duplicated bulk refreshes that retry with
 * exponential backoff. Differences from BullMQ: retries of a bulk refresh do not survive a process restart, and the
 * jobs are not visible in a queue dashboard.
 */

const num = (v: string | undefined, d: number) => (Number.isFinite(Number(v)) && Number(v) >= 0 && v !== undefined && v !== "" ? Number(v) : d);

const INSTANCE = `${process.pid}-${randomUUID().slice(0, 8)}`;

/** Takes the lease if nobody holds it (or it expired). At most one instance can win. */
export async function acquireLease(key: string, ttlMs: number, now = new Date()): Promise<boolean> {
  try {
    const row = await InfraLock.findOneAndUpdate(
      { key, lockedUntil: { $lt: now } },
      { $set: { owner: INSTANCE, lockedUntil: new Date(now.getTime() + ttlMs), lastStartedAt: now } },
      { upsert: true, new: true }
    ).lean<any>();
    return row?.owner === INSTANCE;
  } catch (e) {
    if ((e as { code?: number }).code === 11000) return false; // another instance holds a live lease
    throw e;
  }
}

export async function releaseLease(key: string, result?: unknown): Promise<void> {
  await InfraLock.updateOne({ key, owner: INSTANCE }, { $set: { lockedUntil: new Date(0), lastFinishedAt: new Date(), ...(result !== undefined ? { lastResult: result } : {}) } }).catch(() => undefined);
}

/**
 * One pass of due work, all bounded. Every item is isolated: a registry timeout on one domain never stops the rest, and
 * nothing here changes an asset's expiry state because a *check* failed (failures are recorded as failures).
 */
export async function runSweep(now = new Date()) {
  const hours = (h: number) => new Date(now.getTime() - h * 3_600_000);
  const rdapEvery = num(process.env.INFRA_RDAP_INTERVAL_HOURS, 24);
  const dnsEvery = num(process.env.INFRA_DNS_INTERVAL_HOURS, 6);
  const sslEvery = num(process.env.INFRA_SSL_INTERVAL_HOURS, 24);
  const syncEveryMin = num(process.env.INFRA_PROVIDER_SYNC_MINUTES, 360);
  const stats = { rdap: 0, dns: 0, ssl: 0, providers: 0, evaluated: 0, alertsRaised: 0, cleaned: 0, errors: 0 };
  const swallow = () => { stats.errors += 1; };
  const nullOrOlder = (field: string, h: number) => ({ $or: [{ [field]: null }, { [field]: { $exists: false } }, { [field]: { $lt: hours(h) } }] });

  const rdapDue = await InfraAsset.find({ type: "DOMAIN", archivedAt: null, ...nullOrOlder("domain.rdapCheckedAt", rdapEvery) }).sort({ "domain.rdapCheckedAt": 1 }).limit(40).select("_id").lean<any[]>();
  // Registries rate-limit: two at a time.
  await mapLimit(rdapDue, 2, (d) => refreshRdap(sid(d._id), "scheduled").then(() => { stats.rdap += 1; }).catch(swallow));

  const dnsDue = await InfraAsset.find({ type: "DOMAIN", archivedAt: null, ...nullOrOlder("domain.dnsCheckedAt", dnsEvery) }).sort({ "domain.dnsCheckedAt": 1 }).limit(60).select("_id").lean<any[]>();
  await mapLimit(dnsDue, 4, (d) => refreshDns(sid(d._id), "scheduled").then(() => { stats.dns += 1; }).catch(swallow));

  // Domains without an apex certificate target get one, so SSL data exists without manual setup.
  const domainIds = await InfraAsset.find({ type: "DOMAIN", archivedAt: null }).select("_id").limit(500).lean<any[]>();
  const withCert = new Set((await InfraSslCertificate.find({ assetId: { $in: domainIds.map((d) => d._id) } }).select("assetId").lean<any[]>()).map((c) => sid(c.assetId)));
  for (const d of domainIds.filter((d) => !withCert.has(sid(d._id))).slice(0, 50)) await ensureDefaultCertificate(sid(d._id)).catch(swallow);

  const activeAssetIds = new Set((await InfraAsset.find({ archivedAt: null }).select("_id").lean<any[]>()).map((a) => sid(a._id)));
  const certDue = (await InfraSslCertificate.find({ ...nullOrOlder("lastCheckedAt", sslEvery) }).sort({ lastCheckedAt: 1 }).limit(100).select("_id assetId").lean<any[]>()).filter((c) => c.assetId && activeAssetIds.has(sid(c.assetId)));
  await mapLimit(certDue, 4, (c) => refreshCertificate(sid(c._id), "scheduled").then(() => { stats.ssl += 1; }).catch(swallow));

  if (syncEveryMin > 0) {
    const conns = await InfraProviderConnection.find({
      status: { $in: ["CONNECTED", "ERROR"] }, disconnectedAt: null, credentialsSecret: { $type: "string" },
      $or: [{ lastSyncAt: null }, { lastSyncAt: { $exists: false } }, { lastSyncAt: { $lt: new Date(now.getTime() - syncEveryMin * 60_000) } }],
    }).limit(20).select("_id").lean<any[]>();
    await mapLimit(conns, 2, (c) => syncConnection(sid(c._id), "scheduled").then(() => { stats.providers += 1; }).catch(swallow));
  }

  try {
    const r = await evaluateAlerts(now);
    stats.evaluated = r.items;
    stats.alertsRaised = r.raised;
  } catch (e) {
    swallow();
    logger.warn(`infra.evaluate_failed: ${errMsg(e, "unknown")}`);
  }

  // Collector connectivity (offline alerts); sample retention is a TTL index.
  await failStaleReports(now).catch(swallow);
  const mon = await sweepMonitoring(now).catch(() => { swallow(); return { offline: 0, pruned: 0 }; });
  const cleaned = await InfraDnsSnapshot.deleteMany({ changed: false, checkedAt: { $lt: new Date(now.getTime() - 180 * 86_400_000) } });
  stats.cleaned = cleaned.deletedCount + mon.pruned;
  logger.info(`infra.sweep_done ${JSON.stringify(stats)}`);
  return stats;
}

/** One scheduled tick: run the sweep only if this instance wins the lease. */
export async function sweepIfLeader(): Promise<{ ran: boolean; stats?: Awaited<ReturnType<typeof runSweep>> }> {
  if (!(await acquireLease("sweep", 20 * 60_000))) return { ran: false };
  try {
    const stats = await runSweep();
    await releaseLease("sweep", stats);
    return { ran: true, stats };
  } catch (e) {
    await releaseLease("sweep", { error: errMsg(e) });
    logger.error(`infra.sweep_failed: ${errMsg(e, "unknown")}`);
    return { ran: true };
  }
}

/* ------------------------------------------------------- bulk refresh job */

const inFlight = new Set<string>();

/** Bulk refresh runs in the background with retries; an identical concurrent request is de-duplicated. */
export async function enqueueRefresh(assetIds: string[]): Promise<{ queued: number; deduplicated: boolean }> {
  if (!assetIds.length) return { queued: 0, deduplicated: false };
  const digest = createHash("sha1").update([...assetIds].sort().join(",")).digest("hex").slice(0, 20);
  const key = `refresh-${digest}`;
  if (inFlight.has(key) || !(await acquireLease(key, 10 * 60_000))) return { queued: assetIds.length, deduplicated: true };
  inFlight.add(key);
  void runRefreshWithRetry(key, assetIds).finally(() => inFlight.delete(key));
  return { queued: assetIds.length, deduplicated: false };
}

async function refreshAssets(assetIds: string[]) {
  const out: Array<{ assetId: string; ok: boolean }> = [];
  await mapLimit(assetIds, 2, async (assetId) => {
    try {
      await refreshDomain(assetId, "manual");
      out.push({ assetId, ok: true });
    } catch (e) {
      out.push({ assetId, ok: false });
      logger.warn(`infra.refresh_failed: ${errMsg(e, "unknown")}`);
    }
  });
  const failed = out.filter((o) => !o.ok).length;
  // A failure throws after the batch so the retry re-runs only when everything actually failed.
  if (failed === assetIds.length && failed > 0) throw new Error("Every refresh in the batch failed.");
  return { refreshed: out.length - failed, failed };
}

async function runRefreshWithRetry(key: string, assetIds: string[]) {
  const attempts = 3;
  const base = num(process.env.INFRA_REFRESH_BACKOFF_MS, 30_000);
  for (let n = 1; n <= attempts; n += 1) {
    try {
      await refreshAssets(assetIds);
      break;
    } catch (e) {
      if (n === attempts) logger.error(`infra.refresh_gave_up: ${errMsg(e)}`);
      else await new Promise((r) => setTimeout(r, base * 2 ** (n - 1)));
    }
  }
  await releaseLease(key);
}

/* --------------------------------------------------------------- timer */

let timer: NodeJS.Timeout | null = null;

/** Starts the repeating sweep. Never blocks or fails boot; INFRA_SWEEP_MINUTES=0 or INFRA_SCHEDULER=off disables it. */
export function startInfraScheduler(): void {
  if (timer || process.env.NODE_ENV === "test" || process.env.INFRA_SCHEDULER === "off") return;
  const minutes = num(process.env.INFRA_SWEEP_MINUTES, 30);
  if (minutes <= 0) return;
  const tick = () => { void sweepIfLeader().catch((e) => logger.warn(`infra.scheduler_tick_failed: ${errMsg(e, "unknown")}`)); };
  timer = setInterval(tick, minutes * 60_000);
  timer.unref();
  const first = setTimeout(tick, num(process.env.INFRA_FIRST_SWEEP_DELAY_MS, 60_000));
  first.unref();
}

export function stopInfraScheduler(): void {
  if (timer) clearInterval(timer);
  timer = null;
}
