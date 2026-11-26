import { Request, Response } from "express";
import SemrushImport, { ISemrushImport } from "../../models/semrushImport.model";
import SeoAuditSnapshot from "../../models/seoAudit.model";
import type { CrawlResult } from "./crawler.service";
import type { SiteChecks } from "./siteChecks.service";
import { linkStatusesFromList } from "./linkCheck.service";
import {
  SemrushCsvError,
  detectSemrushFile,
  parseIssuesCsv,
  parsePagesCsv,
  type SemrushIssue,
  type SemrushPage,
} from "./semrushCsv.service";
import {
  buildFixTasks,
  buildSemrushComparison,
  type AuditInput,
  type SemrushComparison,
  type TaskState,
  type TaskStatus,
} from "./semrushCompare.service";
import { getSiteOrigin } from "../../config/seoSite";

const KEEP_IMPORTS = 5;
const TASK_STATUSES: TaskStatus[] = ["open", "in_progress", "done"];
const MAX_NOTE_CHARS = 500;
const MAX_FILE_NAME_CHARS = 200;

const text = (value: unknown): string => (typeof value === "string" ? value : "");
const fileName = (value: unknown): string | null => {
  const name = text(value).trim().slice(0, MAX_FILE_NAME_CHARS);
  return name || null;
};

/** The newest stored audit of the site, in the shape the comparison reads; null when no audit has run yet. */
export async function latestAudit(): Promise<AuditInput | null> {
  const snapshot = await SeoAuditSnapshot.findOne().sort({ createdAt: -1 }).lean();
  if (!snapshot) return null;
  const crawls = ((snapshot.crawls ?? []) as unknown as CrawlResult[]) || [];
  const report = snapshot.report as { generatedAt?: string; site?: { origin?: string } } | undefined;
  return {
    origin: report?.site?.origin || snapshot.origin || getSiteOrigin(),
    crawls,
    siteChecks: (snapshot.siteChecks ?? null) as SiteChecks | null,
    linkStatuses: linkStatusesFromList((snapshot as { linkChecks?: unknown }).linkChecks),
    runAt: report?.generatedAt ?? (snapshot.createdAt ? new Date(snapshot.createdAt).toISOString() : null),
  };
}

function toImportData(doc: ISemrushImport) {
  return {
    id: String(doc._id),
    createdAt: doc.createdAt,
    issuesFileName: doc.issuesFileName,
    pagesFileName: doc.pagesFileName,
    issues: (doc.issues ?? []) as SemrushIssue[],
    pages: doc.pagesFileName ? ((doc.pages ?? []) as SemrushPage[]) : null,
  };
}

async function buildPayload(doc: ISemrushImport) {
  const comparison: SemrushComparison = buildSemrushComparison(toImportData(doc), await latestAudit());
  const tasks = buildFixTasks(comparison, (doc.taskStates ?? {}) as Record<string, TaskState>);
  return { comparison, tasks };
}

export const semrushController = {
  /**
   * POST /api/seo-audit/semrush
   * Body: { issuesCsv, issuesFileName?, pagesCsv?, pagesFileName? } — the text of the two Semrush files.
   * The issues file is required; the mega export is optional and adds the list of pages behind each check.
   */
  async upload(req: Request, res: Response) {
    try {
      const issuesCsv = text(req.body?.issuesCsv);
      const pagesCsv = text(req.body?.pagesCsv);
      if (!issuesCsv.trim()) {
        return res.status(400).json({ success: false, message: "Upload the issues file (the one with Issue Id, Issue Type, Failed checks)." });
      }
      if (detectSemrushFile(issuesCsv) !== "issues") {
        return res.status(400).json({
          success: false,
          message: "The issues file is not a site audit issues export. Its first columns must be: Issue Id, Issue Type, Issue, Failed checks, Total checks.",
        });
      }
      if (pagesCsv.trim() && detectSemrushFile(pagesCsv) !== "pages") {
        return res.status(400).json({
          success: false,
          message: "The page list file is not a site audit page export. Its first column must be 'Page URL', followed by one column per check.",
        });
      }

      const issues = parseIssuesCsv(issuesCsv);
      const pages = pagesCsv.trim() ? parsePagesCsv(pagesCsv) : null;

      const doc = await SemrushImport.create({
        issuesFileName: fileName(req.body?.issuesFileName),
        pagesFileName: pages ? fileName(req.body?.pagesFileName) || "mega export" : null,
        issues,
        pages,
        taskStates: {},
        uploadedBy: req.user?.id ? String(req.user.id) : null,
      });

      const excess = await SemrushImport.find().sort({ createdAt: -1 }).skip(KEEP_IMPORTS).select("_id");
      if (excess.length) await SemrushImport.deleteMany({ _id: { $in: excess.map((d) => d._id) } });

      return res.status(201).json({
        success: true,
        message: `Report imported: ${issues.length} checks${pages ? ` and ${pages.length} pages` : ""}.`,
        data: await buildPayload(doc),
      });
    } catch (error) {
      if (error instanceof SemrushCsvError) return res.status(400).json({ success: false, message: error.message });
      const message = error instanceof Error ? error.message : "Could not import the report";
      return res.status(500).json({ success: false, message });
    }
  },

  /** GET /api/seo-audit/semrush — the comparison and the task list for the newest upload (data: null when none yet). */
  async latest(_req: Request, res: Response) {
    try {
      const doc = await SemrushImport.findOne().sort({ createdAt: -1 });
      if (!doc) {
        return res.status(200).json({ success: true, message: "No report has been uploaded yet.", data: null });
      }
      return res.status(200).json({ success: true, data: await buildPayload(doc) });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not load the comparison";
      return res.status(500).json({ success: false, message });
    }
  },

  /** PATCH /api/seo-audit/semrush/tasks/:issueId — body { status, note? }. Progress belongs to the newest upload. */
  async updateTask(req: Request, res: Response) {
    try {
      const rawId = Array.isArray(req.params.issueId) ? req.params.issueId[0] : req.params.issueId;
      const issueId = Number.parseInt(rawId ?? "", 10);
      const status = text(req.body?.status) as TaskStatus;
      if (!Number.isFinite(issueId) || !TASK_STATUSES.includes(status)) {
        return res.status(400).json({ success: false, message: `status must be one of: ${TASK_STATUSES.join(", ")}.` });
      }
      const doc = await SemrushImport.findOne().sort({ createdAt: -1 });
      if (!doc) return res.status(404).json({ success: false, message: "Upload a report first." });
      if (!(doc.issues as SemrushIssue[]).some((i) => i.id === issueId)) {
        return res.status(404).json({ success: false, message: `Check ${issueId} is not in the latest uploaded report.` });
      }

      const note = typeof req.body?.note === "string" ? req.body.note.trim().slice(0, MAX_NOTE_CHARS) : null;
      const state: TaskState = {
        status,
        note: note || null,
        updatedAt: new Date().toISOString(),
        updatedBy: req.user?.id ? String(req.user.id) : null,
      };
      await SemrushImport.updateOne({ _id: doc._id }, { $set: { [`taskStates.${issueId}`]: state } });

      const fresh = await SemrushImport.findById(doc._id);
      if (!fresh) return res.status(404).json({ success: false, message: "The report was replaced. Reload the page." });
      return res.status(200).json({ success: true, data: await buildPayload(fresh) });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not update the task";
      return res.status(500).json({ success: false, message });
    }
  },
};
