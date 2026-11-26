import { logger } from "../../utils/logger";
import { analyzerConfig } from "./config";
import { startAnalyzerWorker, type WorkerHandle } from "./jobs/worker";
import { startScheduler, stopScheduler } from "./jobs/scheduler";
import { closeSharedRenderer } from "./crawler/renderer";

/* Module bootstrap. Called from server.ts after MongoDB connects. */

let handle: WorkerHandle | null = null;

export function startCompetitorAnalyzer() {
  const cfg = analyzerConfig();
  if (!cfg.COMPETITOR_ANALYZER_ENABLED) {
    logger.info("[competitor-analyzer] disabled (COMPETITOR_ANALYZER_ENABLED=false)");
    return;
  }
  if (cfg.COMPETITOR_INPROCESS_WORKER && !handle) {
    handle = startAnalyzerWorker();
    logger.info(`[competitor-analyzer] in-process worker started (${handle.id})`);
  }
  if (startScheduler()) logger.info("[competitor-analyzer] scheduler started (weekly/monthly studies)");
}

export async function stopCompetitorAnalyzer() {
  stopScheduler();
  await handle?.stop();
  handle = null;
  await closeSharedRenderer();
}

export const analyzerWorkerRunning = () => handle !== null;
