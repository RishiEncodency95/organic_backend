import { createHash, createHmac, randomBytes, randomUUID } from "crypto";
import ReportDownload from "../../models/ReportDownload.model";
import { Queue, Worker, Job } from "bullmq";
import redisClient, { isRedisConnected } from "../../config/redis";
import { assertPublicHttpUrl, safeFetch } from "../../utils/ssrf";
import { computePendingState } from "./seoPending.service";
import SeoFixLog from "../../models/seoFixLog.model";
import { env } from "../../config/env";
import { logger } from "../../utils/logger";
import AdvancedSeo from "../../models/advancedSeo.model";
import SeoAuditSnapshot from "../../models/seoAudit.model";
import { runSiteChecks } from "./siteChecks.service";
import { crawlRoutes, CrawlResult } from "./crawler.service";
import { checkLinks, linkStatusesToList } from "./linkCheck.service";
import { runPageSpeed } from "./psi.service";
import { fetchSearchAnalytics } from "./gsc.service";
import { runLlmVisibility } from "./llm.service";
import { buildSeoCheckupReport } from "./reportBuilder.service";
import { getSiteOrigin } from "../../config/seoSite";
import { seoAutoFixService } from "./seoAutoFix.service";
import { seoAutoPilotService } from "./seoAutoPilot.service";
import type { SiteChecks } from "./siteChecks.service";

const QUEUE_NAME = "seo-audit-queue";

let auditQueue: Queue | null = null;
let auditWorker: Worker | null = null;
let inProcessTimer: NodeJS.Timeout | null = null;
let isAuditInProgress = false;
let isUsingBullMq = false;
let consecutiveFailures = 0;

// ---- one heavy job (audit or auto-fix-all) at a time, across processes (Redis lock with heartbeat) and in this process ----
const LOCK_KEY = "seo:audit:lock";
const ACTIVE_KEY = "seo:audit:active-job";
const LOCK_TTL_MS = 5 * 60 * 1000;
const MAX_LOCK_HOLD_MS = 8 * 60 * 1000;
let lockAcquiredAt: number | null = null;
const heartbeats = new Map<string, NodeJS.Timeout>();
const heldTokens = new Set<string>();

export async function forceUnlockAudit(): Promise<void> {
  isAuditInProgress = false;
  lockAcquiredAt = null;
  for (const [, timer] of heartbeats.entries()) {
    try { clearInterval(timer); } catch {}
  }
  heartbeats.clear();
  heldTokens.clear();
  activeLocal = null;
  if (isRedisConnected()) {
    try {
      await redisClient.del(LOCK_KEY);
      await redisClient.del(ACTIVE_KEY);
    } catch {
      /* ignore redis error during unlock */
    }
  }
}

export async function acquireAuditLock(force: boolean = false): Promise<string | null> {
  const now = Date.now();
  if (isAuditInProgress && lockAcquiredAt && now - lockAcquiredAt > MAX_LOCK_HOLD_MS) {
    logger.warn(`[SEO Audit Lock] Stale in-process lock detected (held for ${Math.round((now - lockAcquiredAt) / 1000)}s). Auto-releasing.`);
    await forceUnlockAudit();
  }

  if (force) {
    logger.info("[SEO Audit Lock] Force acquiring audit lock (clearing previous lock).");
    await forceUnlockAudit();
  } else if (isAuditInProgress) {
    return null;
  }

  const token = randomUUID();
  if (isRedisConnected()) {
    try {
      if (force) {
        await redisClient.del(LOCK_KEY);
      }
      const ok = await redisClient.set(LOCK_KEY, token, "PX", LOCK_TTL_MS, "NX");
      if (ok !== "OK") {
        if (force) {
          await redisClient.set(LOCK_KEY, token, "PX", LOCK_TTL_MS);
        } else {
          return null;
        }
      }
      // keep the lock alive while the job runs; a crashed process stops renewing and the lock expires on its own
      const timer = setInterval(() => {
        redisClient
          .eval("if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('pexpire', KEYS[1], ARGV[2]) else return 0 end", 1, LOCK_KEY, token, String(LOCK_TTL_MS))
          .catch(() => undefined);
      }, LOCK_TTL_MS / 3);
      timer.unref?.();
      heartbeats.set(token, timer);
    } catch (err: any) {
      logger.warn(`[SEO Audit Job] Redis lock unavailable, using in-process lock only: ${err.message}`);
    }
  }
  isAuditInProgress = true;
  lockAcquiredAt = Date.now();
  heldTokens.add(token);
  return token;
}

export async function releaseAuditLock(token: string): Promise<void> {
  isAuditInProgress = false;
  lockAcquiredAt = null;
  heldTokens.delete(token);
  const t = heartbeats.get(token);
  if (t) clearInterval(t);
  heartbeats.delete(token);
  if (!isRedisConnected()) return;
  try {
    // delete only if it is still ours
    await redisClient.eval("if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('del', KEYS[1]) else return 0 end", 1, LOCK_KEY, token);
  } catch {
    /* lock expires by TTL */
  }
}

// ---- which job is active right now (so a second click attaches to it instead of starting another) ----
let activeLocal: { id: string; kind: JobKind } | null = null;
export type JobKind = "audit" | "autofix_all";

async function claimActive(kind: JobKind, id: string): Promise<{ id: string; kind: JobKind } | null> {
  if (activeLocal) return activeLocal;
  if (isRedisConnected()) {
    try {
      const ok = await redisClient.set(ACTIVE_KEY, JSON.stringify({ id, kind }), "PX", 35 * 60 * 1000, "NX");
      if (ok !== "OK") {
        const cur = await redisClient.get(ACTIVE_KEY);
        return cur ? JSON.parse(cur) : { id: "", kind };
      }
    } catch {
      /* fall through to the in-process claim */
    }
  }
  activeLocal = { id, kind };
  return null;
}
async function clearActive(id: string): Promise<void> {
  if (activeLocal?.id === id) activeLocal = null;
  if (!isRedisConnected()) return;
  try {
    await redisClient.eval("local v = redis.call('get', KEYS[1]); if v and string.find(v, ARGV[1], 1, true) then return redis.call('del', KEYS[1]) else return 0 end", 1, ACTIVE_KEY, id);
  } catch {
    /* expires by TTL */
  }
}

/** Whether an audit runs anywhere (this process, or another one holding the Redis lock) */
async function isAuditRunningAnywhere(): Promise<boolean> {
  if (isAuditInProgress) return true;
  if (!isRedisConnected()) return false;
  try {
    return (await redisClient.exists(LOCK_KEY)) === 1;
  } catch {
    return false;
  }
}

// ---- job tracking for the in-process fallback (BullMQ tracks its own) ----
export type AuditJobState = "waiting" | "active" | "completed" | "failed" | "not_found";
interface LocalJob {
  id: string;
  state: AuditJobState;
  progress: number;
  step: string;
  createdAt: number;
  finishedAt?: number;
  result?: unknown;
  error?: string;
}
const localJobs = new Map<string, LocalJob>();
function rememberLocalJob(job: LocalJob) {
  localJobs.set(job.id, job);
  if (localJobs.size > 50) {
    const oldest = Array.from(localJobs.values()).sort((a, b) => a.createdAt - b.createdAt)[0];
    if (oldest) localJobs.delete(oldest.id);
  }
}

// ---- stopping a running audit, and time limits for slow outside services ----
const CANCEL_KEY = "seo:audit:cancel";
export class AuditCancelledError extends Error {
  constructor() {
    super("Audit stopped by an admin.");
  }
}
let cancelFlag = false;

async function cancelAsked(): Promise<boolean> {
  if (cancelFlag) return true;
  if (!isRedisConnected()) return false;
  try {
    return (await redisClient.exists(CANCEL_KEY)) === 1;
  } catch {
    return false;
  }
}

/**
 * Watches for "stop" while a job runs. `guard(promise)` gives up waiting for a slow step the moment an admin asks to stop
 * (the step itself finishes on its own, its result is thrown away); `throwIfCancelled()` is for the gaps between steps.
 */
function watchCancel() {
  let cancelled = false;
  let rejectIt: (e: Error) => void = () => undefined;
  const asked = new Promise<never>((_, rej) => {
    rejectIt = rej;
  });
  asked.catch(() => undefined);
  const timer = setInterval(() => {
    void cancelAsked().then((yes) => {
      if (yes && !cancelled) {
        cancelled = true;
        rejectIt(new AuditCancelledError());
      }
    });
  }, 1000);
  timer.unref?.();
  return {
    guard: <T>(p: Promise<T>): Promise<T> => Promise.race([p, asked]),
    throwIfCancelled() {
      if (cancelled || cancelFlag) throw new AuditCancelledError();
    },
    stop() {
      clearInterval(timer);
    },
  };
}

/** The answer of a slow outside service, or `fallback` when it does not answer in time (or fails) */
export function withDeadline<T>(label: string, p: Promise<T>, ms: number, fallback: T): Promise<T> {
  return new Promise<T>((resolve) => {
    const t = setTimeout(() => {
      logger.warn(`[SEO Audit Job] ${label} did not answer within ${Math.round(ms / 1000)}s: continuing without it.`);
      resolve(fallback);
    }, ms);
    t.unref?.();
    p.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      () => {
        clearTimeout(t);
        resolve(fallback);
      },
    );
  });
}

/** Longest an audit waits for each outside service (PageSpeed, AI assistants, Search Console) */
const PAGESPEED_DEADLINE_MS = 150_000;
// 20 questions asked one after another to each AI assistant (the strategy's monthly test)
const LLM_DEADLINE_MS = 300_000;
const GSC_DEADLINE_MS = 45_000;

export type AuditProgress = (percent: number, step: string) => void | Promise<void>;

const DOWNLOAD_TTL_MS = 6 * 60 * 60 * 1000;
const sha = (v: string) => createHash("sha256").update(v).digest("hex");

/** An opaque, server-side download id (6 hours, 3 downloads). It is NOT a JWT and means nothing to the login system. */
async function createReportDownload(): Promise<{ downloadUrl: string | null; downloadPath: string; downloadExpiresAt: string }> {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + DOWNLOAD_TTL_MS);
  await ReportDownload.create({ tokenHash: sha(token), usesLeft: 3, expiresAt });
  const path = `/seo-audit/report-download?token=${encodeURIComponent(token)}`;
  const base = (env.API_PUBLIC_URL || "").replace(/\/+$/, "");
  return { downloadUrl: base ? `${base}${path}` : null, downloadPath: path, downloadExpiresAt: expiresAt.toISOString() };
}
export async function consumeReportDownload(token: string): Promise<boolean> {
  if (!token || token.length > 200) return false;
  const doc = await ReportDownload.findOneAndUpdate({ tokenHash: sha(token), expiresAt: { $gt: new Date() }, usesLeft: { $gt: 0 } }, { $inc: { usesLeft: -1 } });
  return Boolean(doc);
}

/** Full ioredis options from REDIS_URL: user, password, db and TLS (rediss://) included */
function getRedisConnectionOptions() {
  if (env.REDIS_URL && env.REDIS_URL.startsWith("redis")) {
    try {
      const u = new URL(env.REDIS_URL);
      const db = parseInt(u.pathname.replace("/", "") || "0", 10);
      return {
        host: u.hostname || "127.0.0.1",
        port: parseInt(u.port || "6379", 10),
        username: u.username ? decodeURIComponent(u.username) : undefined,
        password: u.password ? decodeURIComponent(u.password) : undefined,
        db: Number.isFinite(db) ? db : 0,
        tls: u.protocol === "rediss:" ? {} : undefined,
        maxRetriesPerRequest: null,
      };
    } catch {
      // fallback
    }
  }
  return { host: "127.0.0.1", port: 6379, maxRetriesPerRequest: null };
}

/**
 * When the audit runs next. A one-time or on-demand schedule has no next run. A repeating schedule keeps the time of day
 * the admin chose: the next run is the planned time plus whole intervals, never earlier than now.
 */
export function nextRunAfter(frequency: string | undefined, intervalDays: number, planned: Date | undefined | null, now = Date.now()): Date | undefined {
  if (frequency === "once" || frequency === "on_demand") return undefined;
  const step = Math.max(1, intervalDays) * 24 * 60 * 60 * 1000;
  let t = planned ? new Date(planned).getTime() : NaN;
  if (!Number.isFinite(t)) return new Date(now + step);
  if (t <= now) t += Math.ceil((now - t + 1) / step) * step;
  return new Date(t);
}

/**
 * Executes the full real SEO audit run, stores snapshot, and triggers auto-pilot fixes
 */
export async function executeScheduledAuditJob(jobData: any = {}, onProgress?: AuditProgress): Promise<{
  success: boolean;
  skipped?: boolean;
  score: number;
  durationSec: number;
  autoPilotFixesApplied: number;
}> {
  const lockToken = await acquireAuditLock();
  if (!lockToken) {
    logger.warn("[SEO Audit Job] An audit is already running. Skipping trigger.");
    return { success: false, skipped: true, score: 0, durationSec: 0, autoPilotFixesApplied: 0 };
  }

  // a "stop" only ever applies to a run that is already going: forget one left over from an earlier run
  cancelFlag = false;
  if (isRedisConnected()) await redisClient.del(CANCEL_KEY).catch(() => undefined);
  const cancel = watchCancel();

  const progress = async (pct: number, step: string) => {
    cancel.throwIfCancelled();
    try {
      await onProgress?.(pct, step);
    } catch {
      /* progress reporting must never fail the audit */
    }
  };
  const startedAt = Date.now();
  const origin = getSiteOrigin();

  try {
    logger.info(`[SEO Audit Job] Starting autonomous SEO audit for ${origin}...`);

    await progress(5, "Reading sitemap and probing the site");
    // 1. Probes & Sitemap discovery
    let bootstrap: SiteChecks;
    try {
      bootstrap = await cancel.guard(runSiteChecks(origin));
    } catch (err: any) {
      logger.warn(`[SEO Audit Job] Probes warning: ${err.message}`);
      bootstrap = {
        fetchedAt: new Date().toISOString(),
        origin,
        robotsTxt: { available: false, url: null, rules: [], sitemaps: [], error: String(err) },
        sitemap: { available: false, url: null, entries: [], error: String(err) },
        tls: { available: false, subject: null, issuer: null, validFrom: null, validTo: null, daysRemaining: null, serialNumber: null, sigalg: null, san: null, fingerprint256: null, trusted: false, error: String(err) },
        http2: { available: false, error: String(err) },
        headers: { server: null, hsts: null, contentTypeOptions: null, frameOptions: null, referrerPolicy: null, poweredBy: null, cdnIndicators: [] },
        spf: { available: false, records: [], error: String(err) },
        notFoundPage: { status: null, isCustom404: false },
        canonicalization: { apexStatus: null, wwwStatus: null, wwwRedirectsToApex: false },
        adsTxt: { status: null, exists: false },
      };
    }

    let paths = (bootstrap.sitemap?.entries || [])
      .map((entry) => {
        try {
          const u = new URL(entry.loc);
          return u.pathname || "/";
        } catch {
          return null;
        }
      })
      .filter((p): p is string => Boolean(p));

    paths = Array.from(new Set(paths)).slice(0, 50);
    if (!paths.includes("/")) paths = ["/", ...paths];

    await progress(20, "Crawling pages");
    // 2. Live crawl routes
    const crawls: CrawlResult[] = await cancel.guard(crawlRoutes(origin, paths, { concurrency: 2, delayMs: 200 }));

    await progress(55, "Checking links");
    // 3. Link checking
    const linkStatuses = await cancel.guard(checkLinks(crawls).catch(() => null));

    await progress(70, "Running PageSpeed and AI visibility probes");
    // 4. PageSpeed & LLM probes
    const homeCrawl = crawls.find((c) => c.requestedPath === "/") || crawls[0];
    const targetUrl = homeCrawl?.url || `${origin}/`;

    const noGsc = { available: false, message: "Search console did not answer in time", siteUrl: null, rangeStart: null, rangeEnd: null, totals: null, pages: [], fetchedAt: null };
    const [pageSpeedMobile, pageSpeedDesktop, gsc, llm] = await cancel.guard(
      Promise.all([
        withDeadline("PageSpeed (mobile)", runPageSpeed(targetUrl, "mobile"), PAGESPEED_DEADLINE_MS, null),
        withDeadline("PageSpeed (desktop)", runPageSpeed(targetUrl, "desktop"), PAGESPEED_DEADLINE_MS, null),
        withDeadline("Search Console", fetchSearchAnalytics(28), GSC_DEADLINE_MS, noGsc),
        withDeadline("AI visibility probes", runLlmVisibility(), LLM_DEADLINE_MS, []),
      ]),
    );
    cancel.throwIfCancelled();

    // 5. Assemble full report
    const report = buildSeoCheckupReport({
      origin,
      reportRoute: "/",
      crawls,
      siteChecks: bootstrap,
      pageSpeed: pageSpeedMobile,
      pageSpeedDesktop,
      gsc,
      llm,
      linkStatuses,
    });

    await progress(85, "Saving report");
    // 6. Save persistent snapshot
    const durationMs = Date.now() - startedAt;
    await SeoAuditSnapshot.create({
      origin,
      reportRoute: "/",
      report,
      crawls,
      siteChecks: bootstrap,
      linkChecks: linkStatusesToList(linkStatuses),
      gsc,
      llm,
      pageSpeed: pageSpeedMobile,
      pageSpeedDesktop,
      durationMs,
    });

    // Keep history lean (10 snapshots)
    const excess = await SeoAuditSnapshot.find().sort({ createdAt: -1 }).skip(10).select("_id");
    if (excess.length) {
      await SeoAuditSnapshot.deleteMany({ _id: { $in: excess.map((d) => d._id) } });
    }

    // 7. Update schedule timestamps in AdvancedSeo
    const adv = await AdvancedSeo.findOne();
    const intervalDays = adv?.auditSchedule?.intervalDays || 7;
    const autoPilot = adv?.auditSchedule?.autoPilotEnabled || false;

    // Pending state straight after the crawl (before any auto-pilot fix) = "score before"
    const before = await computePendingState().catch(() => null);

    // Auto-Pilot never writes by itself: it prepares suggestions and waits for an admin to approve them.
    // Nothing is applied here, so "applied by auto-pilot" is always 0 for a run.
    const autoPilotFixesApplied = 0;
    let autoPilotWaiting = 0;
    if (autoPilot) {
      await progress(90, "Auto-Pilot is preparing suggestions for your approval");
      try {
        const made = await cancel.guard(
          seoAutoPilotService.createProposal(jobData?.scheduled ? "schedule" : "manual", {
            shouldStop: () => cancel.throwIfCancelled(),
            onProgress: (done, total) => progress(90 + Math.round((8 * done) / Math.max(1, total)), `Auto-Pilot is preparing suggestions (${done} of ${total} pages)`),
          }),
        );
        autoPilotWaiting = made.items;
        logger.info(`[SEO Audit Job] Auto-Pilot prepared ${made.items} suggestion(s) for approval. Nothing was changed.`);
      } catch (fixErr: any) {
        if (fixErr instanceof AuditCancelledError) throw fixErr;
        // the audit itself succeeded: the schedule and the webhook must still happen
        logger.error(`[SEO Audit Job] Auto-Pilot could not prepare suggestions: ${fixErr.message}`);
      }
    }
    const after = before;

    if (adv) {
      if (!adv.auditSchedule) {
        adv.auditSchedule = {
          frequency: "weekly",
          intervalDays: 7,
          autoPilotEnabled: false,
        };
      }
      adv.auditSchedule.lastRunAt = new Date();
      // a manual run must not cancel a one-time run that is still planned
      if (!(adv.auditSchedule.frequency === "once" && !jobData?.scheduled)) {
        adv.auditSchedule.nextRunAt = nextRunAfter(adv.auditSchedule.frequency, intervalDays, adv.auditSchedule.nextRunAt) as any;
      }
      adv.markModified("auditSchedule");
      await adv.save();

      // Dispatch Webhook if configured
      if (adv.auditSchedule.webhookUrl) {
        const appliedTotal = await SeoFixLog.countDocuments({ status: "applied", reverted: false }).catch(() => null);
        await dispatchAuditWebhook(adv.auditSchedule.webhookUrl, {
          event: "seo_audit_completed",
          origin,
          trigger: jobData?.trigger || (jobData?.scheduled ? "schedule" : "manual"),
          completedAt: new Date().toISOString(),
          overallScore: report.seoScore,
          crawledPages: crawls.length,
          autoPilotFixesApplied,
          autoPilotFixesWaitingApproval: autoPilotWaiting,
          summary: {
            reportScore: report.seoScore,
            scoreBefore: before?.healthScore ?? null,
            scoreAfter: after?.healthScore ?? null,
            issuesFoundAtAudit: before ? before.counts.pending + before.counts.resolved : null,
            fixed: after?.counts.resolved ?? null,
            pending: after?.counts.pending ?? null,
            fixedByAutoPilotThisRun: autoPilotFixesApplied,
            totalAppliedFixesAllTime: appliedTotal,
          },
          ...(await createReportDownload().catch(() => ({ downloadUrl: null, downloadPath: null, downloadExpiresAt: null }))),
        });
      }
    }

    consecutiveFailures = 0;
    await progress(100, "Done");

    const durationSec = Math.round(durationMs / 1000);
    logger.info(`[SEO Audit Job] Successfully completed audit in ${durationSec}s. Score: ${report.seoScore}/100.`);

    return {
      success: true,
      score: report.seoScore,
      durationSec,
      autoPilotFixesApplied,
    };
  } catch (err: any) {
    if (err instanceof AuditCancelledError) {
      // stopped on purpose: nothing was saved or changed, and it is not a failure that delays the next scheduled run
      logger.warn("[SEO Audit Job] Stopped by an admin. Nothing was saved.");
      throw err;
    }
    logger.error(`[SEO Audit Job] Execution failed: ${err.message}`);
    // a failed run must not retry on the next 30-minute tick forever: push the next attempt out with a growing backoff
    consecutiveFailures += 1;
    await AdvancedSeo.updateOne(
      { "auditSchedule.frequency": { $ne: "on_demand" } },
      { $set: { "auditSchedule.nextRunAt": new Date(Date.now() + Math.min(24, 2 ** consecutiveFailures) * 60 * 60 * 1000) } }
    ).catch(() => undefined);
    throw err;
  } finally {
    cancel.stop();
    cancelFlag = false;
    if (isRedisConnected()) await redisClient.del(CANCEL_KEY).catch(() => undefined);
    await releaseAuditLock(lockToken);
  }
}

/** Secret used to sign outgoing webhooks: derived from SEO_WEBHOOK_API_KEY, else from the server secret */
function webhookSecret(): string {
  return createHmac("sha256", env.SEO_WEBHOOK_API_KEY || env.ACCESS_TOKEN_SECRET).update("seo-outgoing-webhook").digest("hex");
}
export function signWebhookBody(body: string, timestamp: string): string {
  return `sha256=${createHmac("sha256", webhookSecret()).update(`${timestamp}.${body}`).digest("hex")}`;
}

/**
 * POSTs a payload to the configured webhook. The connection is pinned to the vetted public address (SSRF), redirects are
 * not followed, and the body is signed: header `X-Signature: sha256=HMAC(secret, "<X-Timestamp>.<body>")`.
 */
async function dispatchAuditWebhook(url: string, payload: Record<string, unknown>): Promise<{ ok: boolean; error?: string }> {
  try {
    const body = JSON.stringify(payload);
    const timestamp = String(Math.floor(Date.now() / 1000));
    const res = await safeFetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "User-Agent": "SEO-Audit-Webhook/2.0", "X-Timestamp": timestamp, "X-Signature": signWebhookBody(body, timestamp) },
      body,
      timeoutMs: 10000,
    });
    if (res.status >= 300) {
      logger.warn(`[SEO Audit Job] Webhook answered HTTP ${res.status}`);
      return { ok: false, error: `Webhook answered HTTP ${res.status}` };
    }
    return { ok: true };
  } catch (webhookErr: any) {
    logger.warn(`[SEO Audit Job] Webhook delivery failed: ${webhookErr.message}`);
    return { ok: false, error: webhookErr.message };
  }
}

export { dispatchAuditWebhook };

/** The "Auto-Fix All" job: runs in the queue (never in an HTTP request) under the same lock as an audit. */
export async function executeAutoFixAllJob(jobData: any = {}, onProgress?: AuditProgress): Promise<{
  fixes?: Array<{ route: string; issueType: string; previousValue: unknown; newValue: unknown }>;
  success: boolean;
  skipped?: boolean;
  totalPages: number;
  fixedCount: number;
  failedCount: number;
  skippedCount: number;
  truncated: boolean;
}> {
  const lockToken = await acquireAuditLock();
  if (!lockToken) return { success: false, skipped: true, totalPages: 0, fixedCount: 0, failedCount: 0, skippedCount: 0, truncated: false };
  try {
    await onProgress?.(2, "Looking for fixable pages");
    const r = await seoAutoFixService.autoFixAllPages({}, jobData?.requestedBy || "Admin User", jobData?.maxPages, async (done, total) => {
      await onProgress?.(Math.max(2, Math.round((done / Math.max(1, total)) * 98)), `Fixing pages (${done}/${total})`);
    });
    await onProgress?.(100, "Done");
    // what was really written, so the admin can show it (long values such as schema are cut)
    const cut = (v: unknown) => (typeof v === "string" ? v.slice(0, 300) : v && typeof v === "object" ? JSON.parse(JSON.stringify(v, (_k, x) => (typeof x === "string" ? x.slice(0, 300) : x))) : v);
    const fixes = (r.logs || []).slice(0, 200).map((l: any) => ({ route: l.route, issueType: l.issueType, previousValue: cut(l.previousValue), newValue: cut(l.newValue) }));
    return { success: true, totalPages: r.totalPages, fixedCount: r.fixedCount, failedCount: r.failedCount, skippedCount: r.skippedCount, truncated: r.truncated, fixes };
  } finally {
    await releaseAuditLock(lockToken);
  }
}

/** Stops the worker and queue and releases any lock this process holds (called on SIGTERM / SIGINT) */
export async function shutdownAuditQueue(): Promise<void> {
  if (inProcessTimer) clearInterval(inProcessTimer);
  inProcessTimer = null;
  await auditWorker?.close().catch(() => undefined);
  await auditQueue?.close().catch(() => undefined);
  for (const token of Array.from(heldTokens)) await releaseAuditLock(token);
}

export class ScheduleInputError extends Error {
  status = 400;
}

const SCHEDULER_ID = "recurring-seo-audit";
const JOB_OPTS = { removeOnComplete: { count: 20 }, removeOnFail: { count: 20 } };

/** Makes the BullMQ queue match the saved schedule: a repeating job, one delayed job (one-time), or nothing (on demand) */
async function registerBullSchedule(q: Queue, s: { frequency: string; intervalDays: number; nextRunAt?: Date | null }, reset = false): Promise<void> {
  // a one-time job from an earlier save must not fire after the schedule was changed
  const delayed = await q.getDelayed().catch(() => []);
  for (const j of delayed) if (j.name === "seo-audit-job" && j.data?.once) await j.remove().catch(() => undefined);

  if (s.frequency === "on_demand") {
    await q.removeJobScheduler(SCHEDULER_ID).catch(() => undefined);
    return;
  }
  if (s.frequency === "once") {
    await q.removeJobScheduler(SCHEDULER_ID).catch(() => undefined);
    if (s.nextRunAt) {
      const at = new Date(s.nextRunAt).getTime();
      await q.add("seo-audit-job", { scheduled: true, once: true, trigger: "schedule" }, { delay: Math.max(0, at - Date.now()), jobId: `seo-audit-once-${at}`, ...JOB_OPTS });
    }
    return;
  }
  // BullMQ keeps the already planned next run when a scheduler is upserted, so a changed time needs a fresh scheduler.
  // (Not on a server restart: that would start an audit at every restart.)
  if (reset) await q.removeJobScheduler(SCHEDULER_ID).catch(() => undefined);
  const every = Math.max(1, s.intervalDays) * 24 * 60 * 60 * 1000;
  // start at the time the admin chose (only a future time can be a start; otherwise the queue keeps its own rhythm)
  const start = s.nextRunAt ? new Date(s.nextRunAt) : null;
  const repeat = start && start.getTime() > Date.now() ? { every, startDate: start } : { every };
  await q.upsertJobScheduler(SCHEDULER_ID, repeat, { name: "seo-audit-job", data: { scheduled: true, trigger: "schedule" }, opts: JOB_OPTS });
}

/**
 * Initializes the background queue (BullMQ with Redis, or graceful in-process timer fallback)
 */
export async function initAuditQueue(): Promise<void> {
  const adv = await AdvancedSeo.findOne();
  const schedule = adv?.auditSchedule || {
    frequency: "weekly",
    intervalDays: 7,
    autoPilotEnabled: false,
  };

  if (isRedisConnected()) {
    try {
      const conn = getRedisConnectionOptions();
      auditQueue = new Queue(QUEUE_NAME, { connection: conn });
      auditWorker = new Worker(
        QUEUE_NAME,
        async (job: Job) => {
          logger.info(`[BullMQ Worker] Processing job ${job.id} (${job.name})`);
          const report = async (pct: number, step: string) => {
            await job.updateProgress({ percent: pct, step });
          };
          try {
            return job.name === "autofix-all" ? await executeAutoFixAllJob(job.data, report) : await executeScheduledAuditJob(job.data, report);
          } finally {
            await clearActive(String(job.id));
          }
        },
        { connection: conn, concurrency: 1 }
      );

      auditQueue.on("error", (err) => {
        logger.warn(`[BullMQ Queue] Connection error (handled): ${err.message}`);
      });
      auditWorker.on("error", (err) => {
        logger.warn(`[BullMQ Worker] Connection error (handled): ${err.message}`);
      });

      isUsingBullMq = true;
      logger.info(`[BullMQ] SEO Audit queue initialized with Redis connection. (Interval: ${schedule.intervalDays}d)`);

      // Make the queue match the saved schedule (repeating, one-time, or none for "on demand")
      await registerBullSchedule(auditQueue, schedule as any).catch((e: Error) => logger.error(`[BullMQ] Could not register the schedule: ${e.message}`));

      return;
    } catch (err: any) {
      logger.warn(`[BullMQ] Failed to connect to Redis. Switching to in-process fallback: ${err.message}`);
      isUsingBullMq = false;
    }
  }

  // Graceful In-Process Fallback Mode
  isUsingBullMq = false;
  logger.info("[SEO Queue] Redis is offline. Running in graceful in-process cron fallback mode.");

  if (inProcessTimer) {
    clearInterval(inProcessTimer);
    inProcessTimer = null;
  }

  // Check the schedule every minute in-process (an admin can choose an exact time)
  inProcessTimer = setInterval(async () => {
    try {
      const currentAdv = await AdvancedSeo.findOne();
      const sched = currentAdv?.auditSchedule;
      if (!sched) return;

      const now = Date.now();
      const nextRun = sched.nextRunAt ? new Date(sched.nextRunAt).getTime() : 0;

      if (sched.frequency !== "on_demand" && nextRun > 0 && now >= nextRun && !(await isAuditRunningAnywhere())) {
        logger.info("[In-Process SEO Scheduler] Scheduled audit trigger is due. Starting execution...");
        await executeScheduledAuditJob({ scheduled: true, trigger: "schedule" }).catch((e) => {
          logger.error(`[In-Process SEO Scheduler] Audit error: ${e.message}`);
        });
      }
    } catch (err: any) {
      logger.warn(`[In-Process SEO Scheduler] Polling check failed: ${err.message}`);
    }
  }, 60 * 1000);
}

export const seoAuditQueueService = {
  /**
   * Get current queue and scheduler status
   */
  async getQueueStatus() {
    const adv = await AdvancedSeo.findOne();
    const sched = adv?.auditSchedule || {
      frequency: "weekly",
      intervalDays: 7,
      autoPilotEnabled: false,
      lastRunAt: undefined,
      nextRunAt: undefined,
      webhookUrl: "",
    };

    return {
      usingRedis: isUsingBullMq,
      redisConnected: isRedisConnected(),
      isAuditInProgress: await isAuditRunningAnywhere(),
      schedule: {
        frequency: sched.frequency,
        intervalDays: sched.intervalDays,
        autoPilotEnabled: sched.autoPilotEnabled,
        lastRunAt: sched.lastRunAt,
        nextRunAt: sched.nextRunAt,
        webhookUrl: sched.webhookUrl || "",
      },
      /** Auto-Pilot suggestions waiting for an admin's approval */
      approvalsWaiting: await seoAutoPilotService.waitingCount().catch(() => 0),
    };
  },

  /**
   * Update schedule frequency, interval, and auto-pilot mode
   */
  async updateSchedule(params: {
    frequency: string;
    intervalDays: number;
    autoPilotEnabled: boolean;
    webhookUrl?: string;
    /** The date and time (ISO) of the first run, or of the only run for "once" */
    runAt?: string;
  }) {
    const prevSchedule = (await AdvancedSeo.findOne().select("auditSchedule").lean()) as any;

    if (params.webhookUrl) await assertPublicHttpUrl(params.webhookUrl);
    const frequency = params.frequency || "weekly";
    const onDemand = frequency === "on_demand";
    const once = frequency === "once";
    const intervalDays = frequency === "daily" ? 1 : frequency === "weekly" ? 7 : Math.min(365, Math.max(1, Math.floor(params.intervalDays) || 7));
    const chosen = params.runAt ? new Date(params.runAt) : null;
    if (chosen && Number.isNaN(chosen.getTime())) throw new ScheduleInputError("The date and time are not valid.");
    let nextRunAt: Date | undefined;
    if (once) {
      if (!chosen) throw new ScheduleInputError("Choose the date and time for the one-time audit.");
      if (chosen.getTime() < Date.now() + 30 * 1000) throw new ScheduleInputError("Choose a date and time in the future.");
      nextRunAt = chosen;
    } else if (!onDemand) {
      // a chosen time that has already passed moves forward by whole intervals, keeping its time of day
      nextRunAt = chosen ? nextRunAfter(frequency, intervalDays, chosen) : new Date(Date.now() + intervalDays * 24 * 60 * 60 * 1000);
    }

    const nextSchedule = {
      frequency,
      intervalDays,
      autoPilotEnabled: Boolean(params.autoPilotEnabled),
      lastRunAt: prevSchedule?.auditSchedule?.lastRunAt,
      nextRunAt,
      webhookUrl: params.webhookUrl || "",
    };
    // one atomic upsert of the singleton settings document (two simultaneous first saves cannot create two)
    const adv: any = await AdvancedSeo.findOneAndUpdate({}, { $set: { auditSchedule: nextSchedule } }, { upsert: true, returnDocument: "after" });

    // Reconfigure BullMQ scheduler if active
    if (isUsingBullMq && auditQueue) {
      try {
        await registerBullSchedule(auditQueue, { frequency, intervalDays, nextRunAt }, true);
      } catch (err: any) {
        logger.error(`[BullMQ] Failed to update job scheduler: ${err.message}`);
      }
    }

    return adv.auditSchedule;
  },

  /** Queue a full audit. Returns alreadyRunning (with the running job's id when known) if one is already running. */
  async triggerAudit(options: { trigger?: string; [k: string]: unknown } = {}) {
    return enqueueJob("audit", "manual-seo-audit", options);
  },

  /**
   * Stops the running audit. "stopping": it ends within a second or two and saves nothing. "cleared": nothing was really
   * running (a waiting job, or a lock left behind by a process that died), so it was cleared. "idle": no audit runs.
   * "autofix_running": Auto-Fix All cannot be stopped halfway (each page change is complete on its own).
   */
  async cancelRunning(): Promise<{ result: "stopping" | "cleared" | "idle" | "autofix_running" }> {
    const cur = activeLocal ?? (await readActive());
    const lockHeld = await isAuditRunningAnywhere();
    if (!lockHeld && !cur) return { result: "idle" };
    if (cur?.kind === "autofix_all") return { result: "autofix_running" };

    if (isAuditInProgress) {
      cancelFlag = true;
      if (isRedisConnected()) await redisClient.set(CANCEL_KEY, "1", "PX", 90_000).catch(() => undefined);
      return { result: "stopping" };
    }

    // Not running in this process. Ask any other process to stop (it sees the Redis key), and if the lock is still there a
    // few seconds later it belongs to nothing alive, so it is cleared.
    if (lockHeld && isRedisConnected()) {
      await redisClient.set(CANCEL_KEY, "1", "PX", 90_000).catch(() => undefined);
      for (let i = 0; i < 4; i++) {
        await new Promise((r) => setTimeout(r, 1000));
        if (!(await isAuditRunningAnywhere())) return { result: "stopping" };
      }
    }
    if (cur?.id && isUsingBullMq && auditQueue) await (await auditQueue.getJob(cur.id).catch(() => null))?.remove().catch(() => undefined);
    const local = cur?.id ? localJobs.get(cur.id) : undefined;
    if (local && (local.state === "waiting" || local.state === "active")) {
      local.state = "failed";
      local.error = new AuditCancelledError().message;
      local.finishedAt = Date.now();
    }
    await forceUnlockAudit();
    if (isRedisConnected()) await redisClient.del(CANCEL_KEY).catch(() => undefined);
    return { result: "cleared" };
  },

  /** The job that is running now (if any), so a page can attach to it after a reload or a 409 */
  async getActiveJob(): Promise<{ jobId: string; kind: JobKind } | null> {
    const cur = activeLocal ?? (await readActive());
    return cur && cur.id ? { jobId: cur.id, kind: cur.kind } : null;
  },

  /** Queue "Auto-Fix All" (a job, never inside the HTTP request). */
  async triggerAutoFixAll(options: { requestedBy?: string; maxPages?: number } = {}) {
    return enqueueJob("autofix_all", "autofix-all", options);
  },

  /** Real state / progress of a job started by triggerAudit */
  async getJobStatus(jobId: string): Promise<{
    jobId: string;
    state: AuditJobState;
    progress: number;
    step: string | null;
    result?: unknown;
    error?: string | null;
    skipped?: boolean;
    method: "bullmq" | "in_process_fallback";
  }> {
    const local = localJobs.get(jobId);
    if (local) {
      const skipped = Boolean((local.result as any)?.skipped);
      return { jobId, state: local.state, progress: local.progress, step: local.step, result: local.result, error: local.error ?? null, skipped, method: "in_process_fallback" };
    }
    if (isUsingBullMq && auditQueue && !jobId.startsWith("local-")) {
      const job = await auditQueue.getJob(jobId).catch(() => null);
      if (job) {
        const st = await job.getState().catch(() => "unknown");
        const prog: any = job.progress;
        const isSkipped = Boolean((job.returnvalue as any)?.skipped);
        const state: AuditJobState = st === "completed" && isSkipped ? "failed" : st === "completed" ? "completed" : st === "failed" ? "failed" : st === "active" ? "active" : st === "unknown" ? "not_found" : "waiting";
        return {
          jobId,
          state,
          progress: state === "completed" ? 100 : typeof prog === "object" && prog ? Number(prog.percent) || 0 : Number(prog) || 0,
          step: typeof prog === "object" && prog ? String(prog.step ?? "") : null,
          result: state === "completed" ? job.returnvalue : undefined,
          error: state === "failed" ? job.failedReason || "Audit failed" : isSkipped ? "Another job was already running" : null,
          skipped: isSkipped,
          method: "bullmq",
        };
      }
    }
    return { jobId, state: "not_found", progress: 0, step: null, error: "Unknown job id (it may have expired)", skipped: false, method: isUsingBullMq ? "bullmq" : "in_process_fallback" };
  },
};

interface EnqueueResult {
  triggered: boolean;
  jobId?: string;
  kind?: JobKind;
  method?: "bullmq" | "in_process_fallback";
  alreadyRunning?: boolean;
  /** the job that is running right now (for attaching to it) */
  activeJobId?: string;
}

async function enqueueJob(kind: JobKind, name: string, options: Record<string, unknown>): Promise<EnqueueResult> {
  if (await isAuditRunningAnywhere()) {
    const cur = activeLocal ?? (await readActive());
    return { triggered: false, alreadyRunning: true, activeJobId: cur?.id || undefined, kind: cur?.kind };
  }
  const id = isUsingBullMq && auditQueue ? `${kind}-${randomUUID()}` : `local-${randomUUID()}`;
  const existing = await claimActive(kind, id);
  if (existing) return { triggered: false, alreadyRunning: true, activeJobId: existing.id || undefined, kind: existing.kind };

  if (isUsingBullMq && auditQueue) {
    try {
      const job = await auditQueue.add(name, options, { jobId: id, removeOnComplete: { count: 20 }, removeOnFail: { count: 20 }, attempts: 1 });
      return { triggered: true, jobId: String(job.id), kind, method: "bullmq" };
    } catch (err) {
      await clearActive(id);
      throw err;
    }
  }

  const local: LocalJob = { id, state: "waiting", progress: 0, step: "Queued", createdAt: Date.now() };
  rememberLocalJob(local);
  setImmediate(() => {
    local.state = "active";
    const run = kind === "autofix_all" ? executeAutoFixAllJob(options, (p, s2) => void ((local.progress = p), (local.step = s2))) : executeScheduledAuditJob(options, (p, s2) => void ((local.progress = p), (local.step = s2)));
    run
      .then((result: any) => {
        local.state = result.skipped ? "failed" : "completed";
        local.error = result.skipped ? "Another job was already running" : undefined;
        local.result = result;
        local.progress = result.skipped ? local.progress : 100;
        local.finishedAt = Date.now();
      })
      .catch((err: Error) => {
        local.state = "failed";
        local.error = err.message;
        local.finishedAt = Date.now();
        logger.error(`[Queue] Background ${kind} job failed: ${err.message}`);
      })
      .finally(() => void clearActive(id));
  });
  return { triggered: true, jobId: id, kind, method: "in_process_fallback" };
}

async function readActive(): Promise<{ id: string; kind: JobKind } | null> {
  if (!isRedisConnected()) return null;
  try {
    const cur = await redisClient.get(ACTIVE_KEY);
    return cur ? JSON.parse(cur) : null;
  } catch {
    return null;
  }
}
