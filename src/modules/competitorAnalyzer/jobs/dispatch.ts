import crypto from "node:crypto";
import { Types } from "mongoose";
import { CompetitorRun, CompetitorStudy, SITE_SCOPE } from "../../../models/competitorAnalyzer";
import { analyzerConfig } from "../config";
import { AnalyzerError } from "../errors";

/*
 * Run claim, lease and cancellation on MongoDB (no PostgreSQL row locks):
 *  - One active run per study: CompetitorRun.activeKey (= studyId) has a unique partial index. Inserting a second
 *    active run fails with E11000 and the existing active run is returned (reused: true).
 *  - Idempotency: {studyId, idempotencyKey} unique; a repeated key returns the same run.
 *  - Workers claim with findOneAndUpdate on {status: queued} or {status: running, lease expired}; every later write
 *    is conditioned on the lease token (leaseUpdate), so a worker that lost its lease cannot write.
 *  - Terminal writes unset activeKey. A cancelled run is terminal; completion is conditioned on status=running AND
 *    cancelRequestedAt=null, so a later "completed" can never overwrite a cancellation.
 *  - Recovery: an expired lease whose paid AI attempt had started is NOT re-run; it is moved to
 *    reconciliation_required (unknown paid outcome).
 * This needs no multi-document transaction: the run document is the dispatch record (DECISIONS.md D-004).
 */

const TERMINAL = { $unset: { activeKey: "" } };

export function studySnapshot(study: any) {
  return {
    studyId: String(study._id),
    name: study.name,
    ownUrl: study.ownUrl,
    ownDomain: study.ownDomain,
    competitors: (study.competitors ?? []).slice(0, analyzerConfig().COMPETITOR_MAX_COMPETITORS).map((c: any) => ({ url: c.url, domain: c.domain, name: c.name ?? null })),
    serviceFocus: [...(study.serviceFocus ?? [])],
    geography: { scope: study.geography?.scope ?? "region", places: [...(study.geography?.places ?? [])], country: study.geography?.country ?? "India" },
    goal: study.goal ?? "",
    maxPagesPerSite: study.maxPagesPerSite ?? 10,
    settings: { pagespeed: study.settings?.pagespeed !== false, ai: study.settings?.ai !== false },
  };
}

export async function claimRun(studyId: string, opts: { trigger: "manual" | "scheduled"; idempotencyKey?: string | null; by?: string | null; now?: Date; ignoreCooldown?: boolean }) {
  const now = opts.now ?? new Date();
  if (!Types.ObjectId.isValid(studyId)) throw new AnalyzerError(404, "STUDY_NOT_FOUND", "Study not found");
  const study = await CompetitorStudy.findOne({ _id: studyId, siteScope: SITE_SCOPE }).lean<any>();
  if (!study) throw new AnalyzerError(404, "STUDY_NOT_FOUND", "Study not found");
  if (study.status === "archived") throw new AnalyzerError(409, "STUDY_ARCHIVED", "Archived studies cannot be run");
  if (!study.competitors?.length) throw new AnalyzerError(400, "TOO_MANY_COMPETITORS", "Add at least one competitor before running");

  if (opts.idempotencyKey) {
    const existing = await CompetitorRun.findOne({ studyId: study._id, idempotencyKey: opts.idempotencyKey }).lean<any>();
    if (existing) return { run: existing, reused: true };
  }
  const active = await CompetitorRun.findOne({ activeKey: String(study._id) }).lean<any>();
  if (active) return { run: active, reused: true };

  const cooldownMin = analyzerConfig().COMPETITOR_RUN_COOLDOWN_MINUTES;
  if (!opts.ignoreCooldown && cooldownMin > 0) {
    const recent = await CompetitorRun.findOne({ studyId: study._id, status: "completed", finishedAt: { $gte: new Date(now.getTime() - cooldownMin * 60_000) } }).sort({ finishedAt: -1 }).lean<any>();
    if (recent && recent.configRevision === study.revision) throw new AnalyzerError(429, "RERUN_COOLDOWN", `A run completed less than ${cooldownMin} minutes ago with the same configuration`);
  }
  try {
    const run = await CompetitorRun.create({
      siteScope: SITE_SCOPE,
      studyId: study._id,
      activeKey: String(study._id),
      idempotencyKey: opts.idempotencyKey ?? undefined,
      trigger: opts.trigger,
      studyConfig: studySnapshot(study),
      configRevision: study.revision,
      status: "queued",
      stage: "waiting",
      createdBy: opts.by ?? null,
    });
    await CompetitorStudy.updateOne({ _id: study._id }, { latestRunId: run._id, lastRunAt: now });
    return { run: run.toObject(), reused: false };
  } catch (e: any) {
    if (e?.code === 11000) {
      const winner =
        (opts.idempotencyKey && (await CompetitorRun.findOne({ studyId: study._id, idempotencyKey: opts.idempotencyKey }).lean<any>())) ||
        (await CompetitorRun.findOne({ activeKey: String(study._id) }).lean<any>());
      if (winner) return { run: winner, reused: true };
      throw new AnalyzerError(409, "RUN_ACTIVE", "Another run is starting for this study; retry shortly");
    }
    throw e;
  }
}

export interface Lease {
  runId: Types.ObjectId;
  token: string;
  owner: string;
}

/** Claims the next runnable run for this worker (queued, or running with an expired lease and no paid attempt). */
export async function acquireLease(owner: string, now = new Date()): Promise<{ lease: Lease; run: any } | null> {
  const cfg = analyzerConfig();
  const token = crypto.randomUUID();
  const expiresAt = new Date(now.getTime() + cfg.COMPETITOR_LEASE_MS);
  const run = await CompetitorRun.findOneAndUpdate(
    {
      cancelRequestedAt: null,
      attempts: { $lt: cfg.COMPETITOR_MAX_ATTEMPTS },
      $or: [{ status: "queued" }, { status: "running", "lease.expiresAt": { $lt: now }, paidStartedAt: null }],
    },
    { $set: { status: "running", "lease.owner": owner, "lease.token": token, "lease.expiresAt": expiresAt, heartbeatAt: now, startedAt: now }, $inc: { attempts: 1 } },
    { sort: { createdAt: 1 }, returnDocument: "after" },
  ).lean<any>();
  if (!run) return null;
  return { lease: { runId: run._id, token, owner }, run };
}

/** Lease-guarded update. Returns false when this worker no longer owns the run (lease lost, cancelled, terminal). */
export async function leaseUpdate(lease: Lease, update: Record<string, unknown>, extraFilter: Record<string, unknown> = {}): Promise<boolean> {
  const res = await CompetitorRun.updateOne({ _id: lease.runId, status: "running", "lease.token": lease.token, ...extraFilter }, update);
  return res.modifiedCount === 1 || res.matchedCount === 1;
}

export async function heartbeat(lease: Lease, now = new Date()): Promise<boolean> {
  return leaseUpdate(lease, { $set: { heartbeatAt: now, "lease.expiresAt": new Date(now.getTime() + analyzerConfig().COMPETITOR_LEASE_MS) } });
}

export async function isCancelRequested(runId: Types.ObjectId | string): Promise<boolean> {
  const r = await CompetitorRun.findById(runId).select("cancelRequestedAt status").lean<any>();
  return !r || !!r.cancelRequestedAt || r.status !== "running";
}

/** Marks the paid-attempt boundary. Fails (false) if cancelled or lease lost: then no paid call may be made. */
export async function markPaidStart(lease: Lease, now = new Date()): Promise<boolean> {
  return leaseUpdate(lease, { $set: { paidStartedAt: now, stage: "analysing" } }, { cancelRequestedAt: null });
}

export async function completeRun(lease: Lease, set: Record<string, unknown>, now = new Date()): Promise<boolean> {
  const res = await CompetitorRun.updateOne(
    { _id: lease.runId, status: "running", "lease.token": lease.token, cancelRequestedAt: null },
    { $set: { ...set, status: "completed", stage: "done", finishedAt: now, "lease.expiresAt": null }, ...TERMINAL },
  );
  return res.modifiedCount === 1;
}

export async function failRun(lease: Lease, code: string, message: string, set: Record<string, unknown> = {}, now = new Date()): Promise<boolean> {
  const res = await CompetitorRun.updateOne(
    { _id: lease.runId, status: "running", "lease.token": lease.token },
    { $set: { ...set, status: "failed", stage: "failed", finishedAt: now, error: { code, message: message.slice(0, 500) }, "lease.expiresAt": null }, ...TERMINAL },
  );
  return res.modifiedCount === 1;
}

/** Finalises a run the worker observed as cancel-requested. */
export async function finalizeCancelled(lease: Lease, set: Record<string, unknown> = {}, now = new Date()): Promise<boolean> {
  const res = await CompetitorRun.updateOne(
    { _id: lease.runId, status: "running", "lease.token": lease.token },
    { $set: { ...set, status: "cancelled", stage: "cancelled", finishedAt: now, "lease.expiresAt": null }, ...TERMINAL },
  );
  return res.modifiedCount === 1;
}

/** API: request cancellation. Queued runs are cancelled immediately; running runs are stopped by the worker. */
export async function requestCancel(studyId: string, runId: string, now = new Date()) {
  if (!Types.ObjectId.isValid(runId)) throw new AnalyzerError(404, "RUN_NOT_FOUND", "Run not found");
  const queued = await CompetitorRun.findOneAndUpdate(
    { _id: runId, studyId, siteScope: SITE_SCOPE, status: "queued" },
    { $set: { status: "cancelled", stage: "cancelled", cancelRequestedAt: now, finishedAt: now }, ...TERMINAL },
    { returnDocument: "after" },
  ).lean<any>();
  if (queued) return queued;
  const running = await CompetitorRun.findOneAndUpdate({ _id: runId, studyId, siteScope: SITE_SCOPE, status: "running" }, { $set: { cancelRequestedAt: now } }, { returnDocument: "after" }).lean<any>();
  if (running) return running;
  const exists = await CompetitorRun.findOne({ _id: runId, studyId, siteScope: SITE_SCOPE }).lean<any>();
  if (!exists) throw new AnalyzerError(404, "RUN_NOT_FOUND", "Run not found");
  throw new AnalyzerError(409, "NOT_CANCELLABLE", `Run is already ${exists.status}`);
}

/**
 * Recovery sweep:
 *  - running + expired lease + paid attempt started (and not finished) → reconciliation_required (no blind paid retry)
 *  - running + expired lease + attempts exhausted → failed
 *  - running/queued + cancel requested + expired lease → cancelled
 * Runs with an expired lease and no paid attempt are simply re-claimable by acquireLease.
 */
export async function recoverStale(now = new Date()) {
  const cfg = analyzerConfig();
  const expired = { status: "running", "lease.expiresAt": { $lt: now } };
  const recon = await CompetitorRun.updateMany(
    { ...expired, paidStartedAt: { $ne: null }, paidFinishedAt: null },
    { $set: { status: "reconciliation_required", stage: "reconciliation_required", finishedAt: now, error: { code: "PAID_OUTCOME_UNKNOWN", message: "Worker stopped after the paid AI attempt started; outcome unknown. Collected evidence is kept. Start a new run after reviewing usage." } }, ...TERMINAL },
  );
  const cancelled = await CompetitorRun.updateMany({ ...expired, cancelRequestedAt: { $ne: null } }, { $set: { status: "cancelled", stage: "cancelled", finishedAt: now }, ...TERMINAL });
  // A paid response can finish before the report is committed. Never re-bill it, and never leave its activeKey stuck.
  const interrupted = await CompetitorRun.updateMany(
    { ...expired, paidStartedAt: { $ne: null }, paidFinishedAt: { $ne: null } },
    { $set: { status: "failed", stage: "failed", finishedAt: now, error: { code: "REPORT_SAVE_INTERRUPTED", message: "AI attempt finished but the worker stopped before saving the report. Evidence and usage are retained; no automatic paid retry was made." } }, ...TERMINAL },
  );
  const exhausted = await CompetitorRun.updateMany(
    { ...expired, attempts: { $gte: cfg.COMPETITOR_MAX_ATTEMPTS } },
    { $set: { status: "failed", stage: "failed", finishedAt: now, error: { code: "WORKER_LOST", message: `Worker stopped responding ${cfg.COMPETITOR_MAX_ATTEMPTS} times.` } }, ...TERMINAL },
  );
  return { reconciliation: recon.modifiedCount, cancelled: cancelled.modifiedCount, failed: exhausted.modifiedCount + interrupted.modifiedCount };
}
