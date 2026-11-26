import { Router } from "express";
import { protect } from "../../middlewares/auth.middleware";
import { requirePermission } from "../../middlewares/permission.middleware";
import { seoAuditController } from "./seoAudit.controller";
import { semrushController } from "./semrush.controller";
import { auditTasksController } from "./auditTasks.controller";
import { seoAuditExtrasController as x } from "./seoAuditExtras.controller";
import { reportDownloadLimiter } from "../../middlewares/rateLimiter.middleware";

const router = Router();

// Real SEO audit: live crawl + TLS/DNS/header probes + PageSpeed + Search Console + LLM probes.
// Admin only: running it crawls the site and calls paid third-party APIs, and the reports expose
// internal findings. Reading needs content-view; running an audit needs content-edit.
// The one public route: the Excel report behind a short-lived signed token (sent in the audit webhook).
router.get("/report-download", reportDownloadLimiter, x.reportDownload);

router.use(protect);

router.post("/run", requirePermission("perm_content_edit"), seoAuditController.runAudit);
router.post("/unlock", requirePermission("perm_content_edit"), seoAuditController.unlockAudit);
router.get("/report", requirePermission("perm_content_view"), seoAuditController.getReport);
router.get("/routes", requirePermission("perm_content_view"), seoAuditController.getRoutes);
router.get("/pages", requirePermission("perm_content_view"), seoAuditController.getPages);
router.get("/pages/:id", requirePermission("perm_content_view"), seoAuditController.getPageDetail);
router.get("/pagespeed", requirePermission("perm_content_view"), seoAuditController.getPageSpeed);
router.get("/overview", requirePermission("perm_content_view"), seoAuditController.getOverview);

// Semrush Site Audit CSV files compared with this audit, and the developer / SEO task list that comes out of it.
router.post("/semrush", requirePermission("perm_content_edit"), semrushController.upload);
router.get("/semrush", requirePermission("perm_content_view"), semrushController.latest);
router.patch("/semrush/tasks/:issueId", requirePermission("perm_content_edit"), semrushController.updateTask);

// The fix task list built from this site's own latest audit (no upload needed), and progress on each task.
router.get("/tasks", requirePermission("perm_content_view"), auditTasksController.list);
router.patch("/tasks/:checkId", requirePermission("perm_content_edit"), auditTasksController.update);

// Autonomous Self-Healing SEO, 1-Click Auto-Fixes & Rollback
router.post("/auto-fix", requirePermission("perm_content_edit"), seoAuditController.autoFix);
router.post("/auto-fix-all", requirePermission("perm_content_edit"), x.autoFixAll);
router.post("/rollback", requirePermission("perm_content_edit"), seoAuditController.rollbackFix);
router.get("/fix-logs", requirePermission("perm_content_view"), seoAuditController.getFixLogs);

// Enterprise Multi-Tab Excel (.xlsx) Export
router.get("/export-excel", requirePermission("perm_content_view"), seoAuditController.exportExcel);

// AI Content & Image Authenticity Guard & 1-Click Humanization
router.post("/content-analyze-live", requirePermission("perm_content_view"), seoAuditController.contentAnalyzeLive);
router.get("/site-content-scan", requirePermission("perm_content_view"), seoAuditController.siteContentScan);
router.get("/headings", requirePermission("perm_content_view"), x.headings);
router.get("/social", requirePermission("perm_content_view"), x.socialGet);
router.put("/social", requirePermission("perm_content_edit"), x.socialSave);
router.post("/keywords-from-url", requirePermission("perm_content_view"), x.keywordsFromUrl);
router.post("/ai-images", requirePermission("perm_content_edit"), x.aiImages);
router.get("/content-blocks", requirePermission("perm_content_view"), x.contentBlocks);
router.post("/content-blocks/humanize", requirePermission("perm_content_edit"), x.humanizeContentBlock);
router.post("/content-blocks/apply", requirePermission("perm_content_edit"), x.applyContentBlock);
router.post("/humanize-content", requirePermission("perm_content_edit"), seoAuditController.humanizeContent);

router.post("/content-analyze", requirePermission("perm_content_view"), seoAuditController.contentAnalyzeLive);

// Queue a full audit (returns a job id) and poll its real progress
router.post("/trigger", requirePermission("perm_content_edit"), x.trigger);
router.get("/autopilot", requirePermission("perm_content_view"), x.autopilotOverview);
router.post("/autopilot/decide", requirePermission("perm_content_edit"), x.autopilotDecide);
router.post("/cancel", requirePermission("perm_content_edit"), x.cancel);
router.get("/active-job", requirePermission("perm_content_view"), x.activeJob);
router.get("/status/:jobId", requirePermission("perm_content_view"), x.status);
// Pending vs resolved issues and the live health score
router.get("/pending", requirePermission("perm_content_view"), x.pending);

// Internal-linking mesh (TF-IDF similarity of real page text)
router.get("/internal-links", requirePermission("perm_content_view"), x.linksList);
router.post("/internal-links/generate", requirePermission("perm_content_edit"), x.linksGenerate);
router.post("/internal-links/:id/status", requirePermission("perm_content_edit"), x.linksSetStatus);

// 404 referral log (reports arrive through the public POST /api/seo/404-report)
router.get("/404-log", requirePermission("perm_content_view"), x.notFoundList);
router.post("/404-log/auto-redirect", requirePermission("perm_content_edit"), x.notFoundAutoRedirect);
router.post("/404-log/:id/ignore", requirePermission("perm_content_edit"), x.notFoundIgnore);

// Outreach (white-hat): unlinked brand mentions, LLM-written drafts, push to the outgoing webhook
router.get("/outreach/status", requirePermission("perm_content_view"), x.outreachStatus);
router.post("/outreach/mentions", requirePermission("perm_content_edit"), x.outreachMentions);
router.post("/outreach/draft", requirePermission("perm_content_edit"), x.outreachDraft);
router.get("/outreach/drafts", requirePermission("perm_content_view"), x.outreachDrafts);
router.post("/outreach/drafts/:id/push", requirePermission("perm_content_edit"), x.outreachPush);

// 301 Redirects Management
router.post("/redirect", requirePermission("perm_content_edit"), seoAuditController.addRedirect);
router.get("/redirects", requirePermission("perm_content_view"), seoAuditController.getRedirects);
router.get("/redirects/netlify", requirePermission("perm_content_view"), x.netlifyRedirects);

// Background Audit Queue & Auto-Pilot Cron Schedule
router.get("/schedule", requirePermission("perm_content_view"), seoAuditController.getSchedule);
router.post("/schedule", requirePermission("perm_content_edit"), seoAuditController.updateSchedule);

export default router;
