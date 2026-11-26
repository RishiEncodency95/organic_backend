import { Types } from "mongoose";
import { CompetitorBudgetDay, CompetitorUsage, SITE_SCOPE } from "../../../models/competitorAnalyzer";
import { analyzerConfig } from "../config";
import { estimateCostUsd, reserveCostUsd, type AiCallInput, type AiCallResult, type AiProvider } from "./provider";

/*
 * Budget-controlled AI call lifecycle:
 *   reserve (atomic conditional $inc on the day's committed total)  → usage row "reserved"
 *   paid-start marker (row "started", optional run.paidStartedAt via callback)
 *   provider call
 *   reconcile: completed → actual estimate replaces reservation; not_sent → reservation released;
 *              uncertain → reservation kept and row marked "uncertain" (no automatic retry)
 */

export const today = (d = new Date()) => d.toISOString().slice(0, 10);

export type BudgetedResult = AiCallResult & { usageId: string | null; costUsd: number | null; budgetBlocked?: boolean };

export async function reserveBudget(amountUsd: number, day = today()): Promise<boolean> {
  const cfg = analyzerConfig();
  await CompetitorBudgetDay.updateOne({ siteScope: SITE_SCOPE, day }, { $setOnInsert: { committedUsd: 0 } }, { upsert: true });
  const res = await CompetitorBudgetDay.updateOne(
    { siteScope: SITE_SCOPE, day, committedUsd: { $lte: cfg.COMPETITOR_DAILY_BUDGET_USD - amountUsd } },
    { $inc: { committedUsd: amountUsd } },
  );
  return res.modifiedCount === 1;
}

export async function adjustBudget(deltaUsd: number, day: string) {
  if (deltaUsd) await CompetitorBudgetDay.updateOne({ siteScope: SITE_SCOPE, day }, { $inc: { committedUsd: deltaUsd } });
}

export async function budgetStatus(day = today()) {
  const cfg = analyzerConfig();
  const row = await CompetitorBudgetDay.findOne({ siteScope: SITE_SCOPE, day }).lean<{ committedUsd: number }>();
  const uncertain = await CompetitorUsage.countDocuments({ siteScope: SITE_SCOPE, day, status: "uncertain" });
  return { day, dailyBudgetUsd: cfg.COMPETITOR_DAILY_BUDGET_USD || null, committedUsd: row?.committedUsd ?? 0, uncertainCalls: uncertain };
}

export async function budgetedCall(
  provider: AiProvider,
  input: AiCallInput,
  ctx: { runId?: Types.ObjectId | string | null; studyId?: Types.ObjectId | string | null; onPaidStart?: () => Promise<boolean> },
): Promise<BudgetedResult> {
  const cfg = analyzerConfig();
  const ready = provider.readiness();
  const empty = { ok: false, data: null, rawText: null, usage: { inputTokens: null, outputTokens: null, totalTokens: null }, citations: [], model: ready.model, responseId: null, httpStatus: null, usageId: null, costUsd: null };
  if (ready.state !== "ready") return { ...empty, error: ready.reason, errorClass: "not_sent" };
  const maxOut = input.maxOutputTokens ?? cfg.COMPETITOR_AI_MAX_OUTPUT_TOKENS;
  const reservation = reserveCostUsd(input.system.length + input.user.length, maxOut, !!input.webSearch);
  if (reservation === null) return { ...empty, error: "AI pricing not configured; cannot reserve budget.", errorClass: "not_sent", budgetBlocked: true };
  if (cfg.COMPETITOR_MAX_RUN_COST_USD > 0 && reservation > cfg.COMPETITOR_MAX_RUN_COST_USD) return { ...empty, error: `Estimated call cost $${reservation} exceeds COMPETITOR_MAX_RUN_COST_USD.`, errorClass: "not_sent", budgetBlocked: true };
  const day = today();
  if (!(await reserveBudget(reservation, day))) return { ...empty, error: "Daily AI budget exhausted.", errorClass: "not_sent", budgetBlocked: true };
  const usage = await CompetitorUsage.create({ siteScope: SITE_SCOPE, day, task: input.task, runId: ctx.runId ?? null, studyId: ctx.studyId ?? null, model: ready.model, promptVersion: input.promptVersion, status: "reserved", reservedUsd: reservation });
  // Paid-attempt boundary. If the caller lost its lease/cancelled, release and stop BEFORE spending.
  if (ctx.onPaidStart && !(await ctx.onPaidStart())) {
    await CompetitorUsage.updateOne({ _id: usage._id }, { status: "released", error: "Run no longer owned / cancelled before paid call" });
    await adjustBudget(-reservation, day);
    return { ...empty, error: "Run cancelled or lease lost before AI call.", errorClass: "not_sent", usageId: String(usage._id) };
  }
  await CompetitorUsage.updateOne({ _id: usage._id }, { status: "started" });
  const result = await provider.call(input);
  const cost = estimateCostUsd(result.usage);
  if (result.ok || result.errorClass === "invalid_output") {
    // Billed (tokens were produced). Replace reservation with the actual estimate (or keep reservation if tokens unknown).
    const actual = cost ?? reservation;
    await CompetitorUsage.updateOne({ _id: usage._id }, { status: "completed", inputTokens: result.usage.inputTokens, outputTokens: result.usage.outputTokens, estimatedCostUsd: cost, responseId: result.responseId, model: result.model, error: result.error });
    await adjustBudget(actual - reservation, day);
  } else if (result.errorClass === "not_sent") {
    await CompetitorUsage.updateOne({ _id: usage._id }, { status: "failed_not_sent", error: result.error });
    await adjustBudget(-reservation, day);
  } else {
    await CompetitorUsage.updateOne({ _id: usage._id }, { status: "uncertain", error: result.error });
  }
  return { ...result, usageId: String(usage._id), costUsd: cost };
}
