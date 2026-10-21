import { INFRA_MODELS } from "../../models/infrastructure/infrastructure.models";
import { logger } from "../../utils/logger";
import { startInfraScheduler } from "./infra.scheduler";
import { errMsg } from "./infra.util";

/** Called once from server.ts after the database is connected (only when INFRASTRUCTURE_ENABLED=true). */
export async function initInfrastructure(): Promise<void> {
  // Make sure unique / TTL indexes exist before the first request or sweep relies on them.
  await Promise.all(INFRA_MODELS.map((m) => m.createIndexes().catch((e: unknown) => logger.warn(`infra index ${m.modelName}: ${errMsg(e, "failed")}`))));
  startInfraScheduler();
  logger.info("Infrastructure module enabled");
}
