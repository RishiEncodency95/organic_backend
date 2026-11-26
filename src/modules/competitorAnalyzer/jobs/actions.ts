import crypto from "node:crypto";
import { CompetitorAction, CompetitorRun, CompetitorStudy, SITE_SCOPE } from "../../../models/competitorAnalyzer";
import type { CheckResult } from "../analysis/checks";
import type { ValidatedComparison } from "../ai/validate";

const actionKey = (...parts: string[]) => crypto.createHash("sha1").update(parts.map((p) => p.toLowerCase().replace(/\s+/g, " ").trim()).join("|")).digest("hex").slice(0, 20);
const snapshot = (a: any) => ({ actionKey: a.actionKey, title: a.title, priority: a.priority, status: a.status, recommendation: a.recommendation, source: a.source });

/** Prepare immutable report actions and a durable projection. This function never changes the action board. */
export async function prepareActions(studyId: unknown, runId: unknown, checks: CheckResult[], ai: ValidatedComparison | null) {
  const suggestions: any[] = [];
  for (const c of checks.filter((x) => x.state === "fail" || (x.state === "warn" && ["high", "critical"].includes(x.severity)))) {
    suggestions.push({ actionKey: actionKey("check", c.id), source: "check", checkId: c.id, category: c.category, title: c.title,
      problem: c.explanation, recommendation: c.remediation, evidence: c.sources.map((url) => ({ url, quote: "" })),
      priority: ["critical", "high"].includes(c.severity) ? "high" : c.severity === "medium" ? "medium" : "low", effort: "S", status: "suggested",
      impactRationale: `Deterministic check ${c.id} (${c.state}).`, verificationCriteria: `Check ${c.id} passes in a later run.` });
  }
  for (const r of ai?.recommendations ?? []) suggestions.push({ ...r, actionKey: actionKey("ai", r.category, r.title), source: "ai", status: "needs_review", verificationCriteria: "Reviewer confirms the change on the live page; impact is measured separately." });
  const existing = await CompetitorAction.find({ siteScope: SITE_SCOPE, studyId }).lean<any[]>();
  const passing = new Set(checks.filter((c) => c.state === "pass").map((c) => c.id));
  const verify = existing.filter((a) => a.source === "check" && a.status === "implemented" && passing.has(a.checkId))
    .map((a) => ({ id: a._id, updatedAt: a.updatedAt }));
  const actions = new Map(existing.map((a) => [a.actionKey, snapshot({ ...a, status: verify.some((v) => String(v.id) === String(a._id)) ? "verified" : a.status })]));
  for (const a of suggestions) if (!actions.has(a.actionKey)) actions.set(a.actionKey, snapshot(a));
  return { plan: { suggestions, verify }, actions: [...actions.values()] };
}

/** Only a successfully committed run may change the board. Replaying after a crash is idempotent. */
export async function projectCompletedActions(runId: unknown) {
  const run = await CompetitorRun.findOne({ _id: runId, siteScope: SITE_SCOPE, status: "completed" }).select("studyId report.actionPlan actionsProjectedAt").lean<any>();
  if (!run || run.actionsProjectedAt || !run.report?.actionPlan) return;
  for (const a of run.report.actionPlan.suggestions ?? []) {
    await CompetitorAction.updateOne({ studyId: run.studyId, actionKey: a.actionKey }, {
      $setOnInsert: { siteScope: SITE_SCOPE, studyId: run.studyId, originRunId: run._id, ...a }, $max: { lastSeenRunId: run._id },
    }, { upsert: true });
  }
  for (const v of run.report.actionPlan.verify ?? []) {
    await CompetitorAction.updateOne({ _id: v.id, studyId: run.studyId, status: "implemented", updatedAt: v.updatedAt }, {
      $set: { status: "verified", verifiedByRunId: run._id },
      $push: { history: { at: new Date(), by: "system", field: "status", from: "implemented", to: "verified" } },
    });
  }
  await CompetitorStudy.updateOne({ _id: run.studyId, $or: [{ latestSuccessfulRunId: null }, { latestSuccessfulRunId: { $lt: run._id } }] }, { $set: { latestSuccessfulRunId: run._id } });
  await CompetitorRun.updateOne({ _id: run._id, status: "completed" }, { $set: { actionsProjectedAt: new Date() } });
}

export async function recoverCompletedActions() {
  const runs = await CompetitorRun.find({ siteScope: SITE_SCOPE, status: "completed", actionsProjectedAt: null, "report.actionPlan": { $exists: true } }).select("_id").sort({ _id: 1 }).limit(20).lean<any[]>();
  for (const run of runs) await projectCompletedActions(run._id);
}
