import { NextFunction, Request, Response, Router } from "express";
import { ZodError, ZodType } from "zod";
import { protect } from "../../middlewares/auth.middleware";
import { requirePermission } from "../../middlewares/permission.middleware";
import { ApiError } from "../../utils/ApiError";
import { ApiResponse } from "../../utils/ApiResponse";
import asyncHandler from "../../utils/asyncHandler";
import * as S from "./competitorAnalyzer.schema";
import * as svc from "./competitorAnalyzer.service";
import { analyzerWorkerRunning } from "./index";
import * as settings from "./settings";
import * as google from "./google.service";
import * as share from "./report/share";
import { pdfForRun } from "./report/export";
import { z } from "zod";
import { faviconForWebsite } from "./providers/favicon";

/*
 * /api/admin/competitor-analyzer — dedicated namespace (isolated from the /seo/{*page} wildcard).
 * Every route: JWT `protect` + a dedicated permission, enforced server-side.
 */

export const COMPETITOR_PERMISSIONS = {
  view: "perm_competitor_view",
  manage: "perm_competitor_manage",
  run: "perm_competitor_run",
  export: "perm_competitor_export",
  settings: "perm_competitor_settings",
  share: "perm_competitor_share",
} as const;

const can = (perm: string) => [protect, requirePermission(perm)];

/** Validates and stores the PARSED input (with defaults) on res.locals.input. */
const input = (schema: ZodType) => (req: Request, res: Response, next: NextFunction) => {
  const parsed = schema.safeParse({ body: req.body ?? {}, query: req.query ?? {}, params: req.params ?? {} });
  if (!parsed.success) {
    const issues = (parsed.error as ZodError).issues.map((e) => `${e.path.slice(1).join(".")}: ${e.message}`);
    return next(ApiError.badRequest("Validation failed", issues));
  }
  res.locals.input = parsed.data;
  next();
};
const I = (res: Response) => res.locals.input as { body: any; query: any; params: any };
const userId = (req: Request) => ((req.user as { id?: string } | undefined)?.id ?? null);
const ok = (res: Response, message: string, data: unknown, status = 200) => res.status(status).json(new ApiResponse(status, message, data));

const router = Router();

router.get("/health", ...can(COMPETITOR_PERMISSIONS.view), asyncHandler(async (_req, res) => ok(res, "Provider health", await svc.providerHealth(analyzerWorkerRunning()))));

// Studies
router.get("/studies", ...can(COMPETITOR_PERMISSIONS.view), input(S.listStudiesSchema), asyncHandler(async (_req, res) => ok(res, "Studies", await svc.listStudies(I(res).query))));
router.post("/studies", ...can(COMPETITOR_PERMISSIONS.manage), input(S.createStudySchema), asyncHandler(async (req, res) => ok(res, "Study created", await svc.createStudy(I(res).body, userId(req)), 201)));
router.get("/studies/:id", ...can(COMPETITOR_PERMISSIONS.view), input(S.idParam), asyncHandler(async (_req, res) => ok(res, "Study", await svc.getStudy(I(res).params.id))));
router.patch("/studies/:id", ...can(COMPETITOR_PERMISSIONS.manage), input(S.updateStudySchema), asyncHandler(async (req, res) => ok(res, "Study updated", await svc.updateStudy(I(res).params.id, I(res).body, userId(req)))));
router.delete("/studies/:id", ...can(COMPETITOR_PERMISSIONS.manage), input(S.idParam), asyncHandler(async (req, res) => ok(res, "Study archived", await svc.archiveStudy(I(res).params.id, userId(req)))));
router.post("/studies/:id/restore", ...can(COMPETITOR_PERMISSIONS.manage), input(S.idParam), asyncHandler(async (req, res) => ok(res, "Study restored", await svc.restoreStudy(I(res).params.id, userId(req)))));
const sendIcon = (res: Response, icon: { bytes: Buffer; contentType: string }) => {
  res.setHeader("Content-Type", icon.contentType);
  res.setHeader("Content-Security-Policy", "default-src 'none'; style-src 'unsafe-inline'; sandbox");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Cache-Control", "private, max-age=21600");
  res.send(icon.bytes);
};
router.get("/studies/:id/favicon", ...can(COMPETITOR_PERMISSIONS.view), input(S.idParam), asyncHandler(async (_req, res) => {
  const { study } = await svc.getStudy(I(res).params.id);
  sendIcon(res, await faviconForWebsite(study.ownUrl, svc.getServiceDeps().fetcher));
}));

// Runs
router.post("/studies/:id/runs", ...can(COMPETITOR_PERMISSIONS.run), input(S.startRunSchema), asyncHandler(async (req, res) => {
  const r = await svc.startRun(I(res).params.id, I(res).body, userId(req));
  return ok(res, r.reused ? "An active run already exists" : "Run queued", r, 202);
}));
router.get("/studies/:id/runs", ...can(COMPETITOR_PERMISSIONS.view), input(S.listRunsSchema), asyncHandler(async (_req, res) => ok(res, "Runs", await svc.listRuns(I(res).params.id, I(res).query))));
router.get("/studies/:id/compare", ...can(COMPETITOR_PERMISSIONS.view), input(S.compareRunsSchema), asyncHandler(async (_req, res) => ok(res, "Run comparison", await svc.compareRuns(I(res).params.id, I(res).query.from, I(res).query.to))));
router.get("/studies/:id/runs/:runId", ...can(COMPETITOR_PERMISSIONS.view), input(S.runParams), asyncHandler(async (_req, res) => ok(res, "Run", await svc.getRun(I(res).params.id, I(res).params.runId))));
router.get("/studies/:id/runs/:runId/snapshots/:domain", ...can(COMPETITOR_PERMISSIONS.view), input(S.snapshotParams), asyncHandler(async (_req, res) => ok(res, "Snapshot", await svc.getSnapshot(I(res).params.id, I(res).params.runId, I(res).params.domain))));
router.post("/studies/:id/runs/:runId/stop", ...can(COMPETITOR_PERMISSIONS.run), input(S.runParams), asyncHandler(async (_req, res) => {
  const r = await (await import("./jobs/dispatch")).requestCancel(I(res).params.id, I(res).params.runId);
  return ok(res, r.status === "cancelled" ? "Run cancelled" : "Cancellation requested", { runId: String(r._id), status: r.status, cancelRequestedAt: r.cancelRequestedAt });
}));
router.get("/studies/:id/runs/:runId/export", ...can(COMPETITOR_PERMISSIONS.export), input(S.runParams), asyncHandler(async (_req, res) => ok(res, "Export", await svc.exportRun(I(res).params.id, I(res).params.runId))));

// PDF (English / Hindi) and screenshots — from the saved run only
router.get("/studies/:id/runs/:runId/pdf", ...can(COMPETITOR_PERMISSIONS.export), input(S.pdfSchema), (req, res, next) => {
  // Export-only users may read cached translations, but cannot spend the AI budget.
  void requirePermission(COMPETITOR_PERMISSIONS.run)(req, res, (error?: any) => {
    if (error && error.statusCode !== 403) return next(error);
    res.locals.allowTranslate = !error;
    next();
  });
}, asyncHandler(async (_req, res) => {
  const { pdf, filename } = await pdfForRun(I(res).params.id, I(res).params.runId, I(res).query.lang, { allowTranslate: res.locals.allowTranslate === true });
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.send(pdf);
}));
router.get("/studies/:id/runs/:runId/screenshots/:domain", ...can(COMPETITOR_PERMISSIONS.view), input(S.screenshotSchema), asyncHandler(async (_req, res) => {
  await svc.getRun(I(res).params.id, I(res).params.runId);
  res.setHeader("Content-Type", "image/jpeg");
  res.setHeader("Cache-Control", "private, max-age=86400");
  res.send(await share.screenshotFor(I(res).params.runId, I(res).params.domain));
}));
router.get("/studies/:id/runs/:runId/favicons/:domain", ...can(COMPETITOR_PERMISSIONS.view), input(S.screenshotSchema), asyncHandler(async (_req, res) => {
  const snapshot = await svc.getSnapshot(I(res).params.id, I(res).params.runId, I(res).params.domain);
  sendIcon(res, await faviconForWebsite(snapshot.crawl.rootUrl, svc.getServiceDeps().fetcher));
}));

// Share links (fixed run, expiring, revocable)
router.get("/studies/:id/shares", ...can(COMPETITOR_PERMISSIONS.share), input(S.idParam), asyncHandler(async (_req, res) => ok(res, "Share links", await share.listShares(I(res).params.id))));
router.post("/studies/:id/shares", ...can(COMPETITOR_PERMISSIONS.share), input(S.createShareSchema), asyncHandler(async (req, res) => ok(res, "Share link created", await share.createShare(I(res).params.id, I(res).body, userId(req)), 201)));
router.delete("/studies/:id/shares/:shareId", ...can(COMPETITOR_PERMISSIONS.share), input(S.shareParams), asyncHandler(async (_req, res) => ok(res, "Share link revoked", await share.revokeShare(I(res).params.id, I(res).params.shareId))));

// Actions
router.get("/studies/:id/actions", ...can(COMPETITOR_PERMISSIONS.view), input(S.listActionsSchema), asyncHandler(async (_req, res) => ok(res, "Actions", await svc.listActions(I(res).params.id, I(res).query))));
router.patch("/studies/:id/actions/:actionId", ...can(COMPETITOR_PERMISSIONS.manage), input(S.updateActionSchema), asyncHandler(async (req, res) => ok(res, "Action updated", await svc.updateAction(I(res).params.id, I(res).params.actionId, I(res).body, userId(req)))));

// Discovery & watchlist
router.post("/discovery/search", ...can(COMPETITOR_PERMISSIONS.run), input(S.discoverySchema), asyncHandler(async (req, res) => ok(res, "Discovery finished", await svc.discoverCandidates(I(res).body, userId(req)))));
router.post("/discovery/auto", ...can(COMPETITOR_PERMISSIONS.run), input(S.autoDiscoverSchema), asyncHandler(async (req, res) => ok(res, "Competitors found", await svc.autoDiscover(I(res).body, userId(req)))));
router.get("/candidates", ...can(COMPETITOR_PERMISSIONS.view), input(S.listCandidatesSchema), asyncHandler(async (_req, res) => ok(res, "Candidates", await svc.listCandidates(I(res).query))));
router.post("/candidates", ...can(COMPETITOR_PERMISSIONS.manage), input(S.addCandidateSchema), asyncHandler(async (req, res) => {
  const r = await svc.addCandidate(I(res).body, userId(req));
  return ok(res, r.created ? "Candidate added" : "Candidate already existed; discovery recorded", r.candidate, r.created ? 201 : 200);
}));
router.patch("/candidates/:id", ...can(COMPETITOR_PERMISSIONS.manage), input(S.updateCandidateSchema), asyncHandler(async (_req, res) => ok(res, "Candidate updated", await svc.updateCandidate(I(res).params.id, I(res).body, userId(_req)))));
router.post("/candidates/:id/verify", ...can(COMPETITOR_PERMISSIONS.manage), input(S.idParam), asyncHandler(async (_req, res) => ok(res, "Candidate verified", await svc.verifyCandidate(I(res).params.id))));
router.delete("/candidates/:id", ...can(COMPETITOR_PERMISSIONS.manage), input(S.idParam), asyncHandler(async (_req, res) => {
  await svc.deleteCandidate(I(res).params.id);
  return ok(res, "Candidate deleted", null);
}));

// Keywords
router.post("/keywords/generate", ...can(COMPETITOR_PERMISSIONS.run), input(S.keywordGenerateSchema), asyncHandler(async (_req, res) => ok(res, "Keywords processed", await svc.generateKeywords(I(res).body))));
router.get("/keywords", ...can(COMPETITOR_PERMISSIONS.view), input(S.listKeywordsSchema), asyncHandler(async (_req, res) => ok(res, "Keywords", await svc.listKeywords(I(res).query))));

// Settings & training (no code changes needed): taxonomy, weights, check overrides, prompt context, guidance, feedback
const settingsPut = z.object({ body: z.object({ expectedVersion: z.coerce.number().int().min(0), settings: z.unknown(), note: z.string().trim().max(300).default("") }) });
const rollbackBody = z.object({ body: z.object({ version: z.coerce.number().int().min(1), expectedVersion: z.coerce.number().int().min(1) }) });
const guidanceBody = z.object({ body: z.object({ lesson: z.string().trim().min(5).max(400) }) });
const feedbackPatch = z.object({ params: z.object({ id: z.string().regex(/^[a-f0-9]{24}$/i) }), body: z.object({ active: z.boolean() }) });

router.get("/settings", ...can(COMPETITOR_PERMISSIONS.view), asyncHandler(async (_req, res) => {
  const a = await settings.loadActiveSettings({ fresh: true });
  return ok(res, "Analyzer settings", { ...a, defaults: settings.DEFAULT_SETTINGS });
}));
router.put("/settings", ...can(COMPETITOR_PERMISSIONS.settings), input(settingsPut), asyncHandler(async (req, res) => ok(res, "Settings saved", await settings.saveSettings(I(res).body.settings, I(res).body.expectedVersion, userId(req), I(res).body.note))));
router.get("/settings/versions", ...can(COMPETITOR_PERMISSIONS.settings), asyncHandler(async (_req, res) => ok(res, "Settings versions", await settings.listSettingsVersions())));
router.post("/settings/rollback", ...can(COMPETITOR_PERMISSIONS.settings), input(rollbackBody), asyncHandler(async (req, res) => ok(res, "Settings rolled back", await settings.rollbackSettings(I(res).body.version, I(res).body.expectedVersion, userId(req)))));
router.get("/settings/feedback", ...can(COMPETITOR_PERMISSIONS.settings), asyncHandler(async (_req, res) => ok(res, "Feedback", await settings.listFeedback())));
router.post("/settings/feedback", ...can(COMPETITOR_PERMISSIONS.settings), input(guidanceBody), asyncHandler(async (req, res) => {
  await settings.recordFeedback("guidance", I(res).body.lesson, { by: userId(req) });
  return ok(res, "Guidance added", null, 201);
}));
router.patch("/settings/feedback/:id", ...can(COMPETITOR_PERMISSIONS.settings), input(feedbackPatch), asyncHandler(async (_req, res) => ok(res, "Feedback updated", await settings.setFeedbackActive(I(res).params.id, I(res).body.active))));

// Google Search Console (own property). Callback is the ONLY route without JWT: protected by signed single-use state.
const propertyBody = z.object({ body: z.object({ property: z.string().trim().min(5).max(300) }) });
const adminBase = () => (process.env.ADMIN_URL || "http://localhost:3003").replace(/\/+$/, "");
router.get("/google/status", ...can(COMPETITOR_PERMISSIONS.view), asyncHandler(async (_req, res) => ok(res, "Google status", await google.googleStatus())));
router.post("/google/connect", ...can(COMPETITOR_PERMISSIONS.settings), asyncHandler(async (req, res) => ok(res, "Open this URL to connect", await google.startConnect(String(userId(req))))));
router.get("/google/callback", asyncHandler(async (req, res) => {
  try {
    await google.handleCallback({ code: req.query.code as string, state: req.query.state as string, error: req.query.error as string });
    res.redirect(302, `${adminBase()}/competitor-analyzer?google=connected`);
  } catch (e) {
    res.redirect(302, `${adminBase()}/competitor-analyzer?google=error&reason=${encodeURIComponent(String((e as Error).message).slice(0, 160))}`);
  }
}));
router.post("/google/disconnect", ...can(COMPETITOR_PERMISSIONS.settings), asyncHandler(async (_req, res) => ok(res, "Disconnected", await google.disconnect())));
router.get("/search-console/properties", ...can(COMPETITOR_PERMISSIONS.settings), asyncHandler(async (_req, res) => ok(res, "Properties", await google.listProperties())));
router.put("/search-console/property", ...can(COMPETITOR_PERMISSIONS.settings), input(propertyBody), asyncHandler(async (_req, res) => ok(res, "Property saved", await google.setProperty(I(res).body.property))));
router.post("/search-console/sync", ...can(COMPETITOR_PERMISSIONS.run), asyncHandler(async (_req, res) => ok(res, "Search Console synced", await google.syncSearchConsole())));

export default router;

/* Public, read-only shared report (no login). Token-protected; allow-listed DTO only; never spends AI budget. */
export const competitorPublicRouter = Router();
const tokenParams = z.object({ params: z.object({ token: z.string().regex(/^[A-Za-z0-9_-]{40,60}$/) }), query: z.object({ lang: z.enum(["en", "hi"]).default("en") }).passthrough() });
const tokenShot = z.object({ params: z.object({ token: z.string().regex(/^[A-Za-z0-9_-]{40,60}$/), domain: z.string().regex(/^[a-z0-9.-]{3,253}$/i) }) });
competitorPublicRouter.get("/:token", input(tokenParams), asyncHandler(async (_req, res) => {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Robots-Tag", "noindex, nofollow");
  return ok(res, "Shared report", await share.publicReport(I(res).params.token));
}));
competitorPublicRouter.get("/:token/pdf", input(tokenParams), asyncHandler(async (_req, res) => {
  const { run } = await share.resolveShare(I(res).params.token, false);
  const { pdf, filename } = await pdfForRun(String(run.studyId), String(run._id), I(res).query.lang, { allowTranslate: false, public: true });
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.setHeader("X-Robots-Tag", "noindex, nofollow");
  res.send(pdf);
}));
competitorPublicRouter.get("/:token/screenshots/:domain", input(tokenShot), asyncHandler(async (_req, res) => {
  const { run } = await share.resolveShare(I(res).params.token, false);
  res.setHeader("Content-Type", "image/jpeg");
  res.send(await share.screenshotFor(run._id, I(res).params.domain));
}));
competitorPublicRouter.get("/:token/favicons/:domain", input(tokenShot), asyncHandler(async (_req, res) => {
  const { run } = await share.resolveShare(I(res).params.token, false);
  const snapshot = await svc.getSnapshot(String(run.studyId), String(run._id), I(res).params.domain);
  sendIcon(res, await faviconForWebsite(snapshot.crawl.rootUrl, svc.getServiceDeps().fetcher));
}));
