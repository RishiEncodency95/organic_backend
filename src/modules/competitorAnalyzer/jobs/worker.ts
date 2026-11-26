import os from "node:os";
import crypto from "node:crypto";
import { logger } from "../../../utils/logger";
import { analyzerConfig } from "../config";
import { acquireLease, recoverStale } from "./dispatch";
import { executeRun, type RunnerDeps } from "./runner";
import { CompetitorWorker, SITE_SCOPE } from "../../../models/competitorAnalyzer";
import { recoverCompletedActions } from "./actions";

/*
 * Worker. MongoDB is the source of truth for dispatch (DECISIONS.md D-004): the loop claims runs with an atomic
 * lease, so it keeps working when Redis is down. When COMPETITOR_QUEUE_ENABLED and Redis are available, a BullMQ
 * queue is used purely as a low-latency wake-up signal; losing a Redis message never loses a run.
 * Run in-process (COMPETITOR_INPROCESS_WORKER=true, default) or as a dedicated process (scripts/competitor_worker.ts).
 */

export interface WorkerHandle {
  id: string;
  stop: () => Promise<void>;
  wake: () => void;
  tick: () => Promise<number>;
}

let queueRef: { add: (name: string, data: unknown) => Promise<unknown> } | null = null;

/** Best-effort wake-up signal after a run is queued. Never required for correctness. */
export async function signalRunQueued(runId: string) {
  localWake?.();
  try {
    await queueRef?.add("run", { runId });
  } catch {
    /* Redis unavailable: the poll loop will pick the run up */
  }
}

let localWake: (() => void) | null = null;

export function startAnalyzerWorker(deps: RunnerDeps = {}, opts: { pollMs?: number; concurrency?: number } = {}): WorkerHandle {
  const cfg = analyzerConfig();
  const id = `${os.hostname()}:${process.pid}:${crypto.randomUUID().slice(0, 8)}`;
  const concurrency = opts.concurrency ?? cfg.COMPETITOR_WORKER_CONCURRENCY;
  const pollMs = opts.pollMs ?? cfg.COMPETITOR_POLL_MS;
  let active = 0;
  let stopped = false;
  let timer: NodeJS.Timeout | null = null;
  const running = new Set<Promise<unknown>>();
  let ticking = false;

  const tick = async (): Promise<number> => {
    if (stopped || ticking) return 0;
    ticking = true;
    let started = 0;
    try {
      const heartbeatAt = new Date();
      await CompetitorWorker.updateOne({ _id: id }, { $set: { siteScope: SITE_SCOPE, heartbeatAt, expiresAt: new Date(heartbeatAt.getTime() + Math.max(60_000, pollMs * 3)) } }, { upsert: true });
      await recoverStale();
      await recoverCompletedActions();
      while (active < concurrency && !stopped) {
        const claim = await acquireLease(id);
        if (!claim) break;
        active += 1;
        started += 1;
        const p = executeRun(claim.lease, claim.run, deps)
          .then((outcome) => logger.info(`[competitor-analyzer] run ${String(claim.run._id)} → ${outcome}`))
          .catch((e) => logger.error(`[competitor-analyzer] worker error: ${(e as Error).message}`))
          .finally(() => {
            active -= 1;
            running.delete(p);
            schedule(0);
          });
        running.add(p);
      }
    } catch (e) {
      logger.error(`[competitor-analyzer] poll failed: ${(e as Error).message}`);
    } finally {
      ticking = false;
    }
    return started;
  };
  const schedule = (ms: number) => {
    if (stopped) return;
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      tick().finally(() => schedule(pollMs));
    }, ms);
  };
  localWake = () => schedule(0);
  schedule(500);

  if (cfg.COMPETITOR_QUEUE_ENABLED) void attachQueue(() => schedule(0));

  return {
    id,
    tick,
    wake: () => schedule(0),
    stop: async () => {
      stopped = true;
      if (timer) clearTimeout(timer);
      await Promise.allSettled([...running]);
      await CompetitorWorker.deleteOne({ _id: id });
    },
  };
}

async function attachQueue(onMessage: () => void) {
  try {
    const { Queue, Worker } = await import("bullmq");
    const url = process.env.REDIS_URL || "redis://localhost:6379";
    const connection = { url, maxRetriesPerRequest: null as null } as any;
    const queue = new Queue("competitor-analyzer", { connection });
    queueRef = { add: (name, data) => queue.add(name, data, { removeOnComplete: 100, removeOnFail: 100 }) };
    const w = new Worker("competitor-analyzer", async () => onMessage(), { connection, concurrency: 1 });
    w.on("error", (e) => logger.warn(`[competitor-analyzer] BullMQ: ${e.message}`));
    queue.on("error", (e) => logger.warn(`[competitor-analyzer] BullMQ queue: ${e.message}`));
  } catch (e) {
    queueRef = null;
    logger.warn(`[competitor-analyzer] BullMQ unavailable, using MongoDB polling only: ${(e as Error).message}`);
  }
}

export function queueReady() {
  return queueRef !== null;
}
