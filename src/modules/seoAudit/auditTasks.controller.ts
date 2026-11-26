import { Request, Response } from "express";
import SemrushImport from "../../models/semrushImport.model";
import SeoTaskState from "../../models/seoTaskState.model";
import { latestAudit } from "./semrush.controller";
import { buildAuditTasks, type TaskStateRecord, type TaskStatus } from "./auditTasks.service";
import { buildSemrushComparison } from "./semrushCompare.service";
import type { SemrushIssue, SemrushPage } from "./semrushCsv.service";
import { SITE_AUDIT_CHECKS } from "./siteAuditCatalog";

const STATUSES: TaskStatus[] = ["open", "in_progress", "done"];
const MAX_NOTE_CHARS = 500;

async function buildPayload() {
  const audit = await latestAudit();
  if (!audit) return null;
  const states = new Map<number, TaskStateRecord>();
  for (const s of await SeoTaskState.find().lean()) states.set(s.checkId, { status: s.status, note: s.note, updatedAt: s.updatedAt });

  // An uploaded report is optional: it only adds "also found by the uploaded report" and what this audit cannot check.
  const upload = await SemrushImport.findOne().sort({ createdAt: -1 });
  const uploaded = upload
    ? buildSemrushComparison(
        {
          id: String(upload._id),
          createdAt: upload.createdAt,
          issuesFileName: upload.issuesFileName,
          pagesFileName: upload.pagesFileName,
          issues: (upload.issues ?? []) as SemrushIssue[],
          pages: upload.pagesFileName ? ((upload.pages ?? []) as SemrushPage[]) : null,
        },
        audit,
      ).checks
    : null;

  return buildAuditTasks({
    ctx: { origin: audit.origin, crawls: audit.crawls, siteChecks: audit.siteChecks, linkStatuses: audit.linkStatuses },
    runAt: audit.runAt,
    states,
    uploaded,
    uploadedName: upload?.issuesFileName ?? null,
  });
}

export const auditTasksController = {
  /** GET /api/seo-audit/tasks — the developer / SEO task list from the latest audit (data: null when no audit has run). */
  async list(_req: Request, res: Response) {
    try {
      const data = await buildPayload();
      if (!data) return res.status(200).json({ success: true, message: "No audit has been run yet. Run an audit in tab 1.", data: null });
      return res.status(200).json({ success: true, data });
    } catch (error) {
      return res.status(500).json({ success: false, message: error instanceof Error ? error.message : "Could not build the task list" });
    }
  },

  /** PATCH /api/seo-audit/tasks/:checkId — body { status, note? }. */
  async update(req: Request, res: Response) {
    try {
      const raw = Array.isArray(req.params.checkId) ? req.params.checkId[0] : req.params.checkId;
      const checkId = Number.parseInt(raw ?? "", 10);
      const status = String(req.body?.status ?? "") as TaskStatus;
      if (!SITE_AUDIT_CHECKS.some((c) => c.id === checkId) || !STATUSES.includes(status)) {
        return res.status(400).json({ success: false, message: `Give a known check id and a status of: ${STATUSES.join(", ")}.` });
      }
      const note = typeof req.body?.note === "string" ? req.body.note.trim().slice(0, MAX_NOTE_CHARS) : null;
      await SeoTaskState.updateOne(
        { checkId },
        { $set: { status, note: note || null, updatedBy: req.user?.id ? String(req.user.id) : null, updatedAt: new Date() } },
        { upsert: true },
      );
      const data = await buildPayload();
      return res.status(200).json({ success: true, data });
    } catch (error) {
      return res.status(500).json({ success: false, message: error instanceof Error ? error.message : "Could not update the task" });
    }
  },
};
