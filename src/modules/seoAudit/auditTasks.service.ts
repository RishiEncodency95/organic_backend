/**
 * The fix task list, built from OUR OWN latest audit: every failing check of the 101, with the pages it is on, the
 * evidence, who fixes it and where. It needs no uploaded report. When one was uploaded, tasks it also reported are
 * marked, and checks it reported that this audit cannot measure are added so nothing is lost.
 */

import { evidenceFor, OUR_CHECKS, type OurContext } from "./semrushOurChecks";
import { buildAuditContext } from "./siteAudit.checks";
import { SITE_AUDIT_CHECKS, type ChecklistType } from "./siteAuditCatalog";
import { SEMRUSH_CATALOG, SITEWIDE_SHARE } from "./semrushCatalog";
import { guideFor, siteFacts } from "./checklist.service";
import type { ComparedCheck } from "./semrushCompare.service";

export type TaskStatus = "open" | "in_progress" | "done";

export interface AuditTask {
  checkId: number;
  title: string;
  type: ChecklistType;
  priority: "high" | "medium" | "low";
  section: string;
  owner: "developer" | "seo";
  ownerReason: string | null;
  what: string;
  why: string;
  fix: string;
  where: string;
  scope: "page" | "site";
  /** True when it is on most pages, so it comes from the shared layout and is fixed once. */
  sitewide: boolean;
  affectedPages: string[];
  affectedTotal: number;
  /** How many pages were looked at. */
  pagesChecked: number;
  evidence: string[];
  /** "ours": found by this audit. "uploaded_only": only the uploaded report found it, this audit cannot check it. */
  source: "ours" | "uploaded_only";
  inUploadedReport: boolean;
  status: TaskStatus;
  note: string | null;
  updatedAt: string | null;
}

export interface FixedItem {
  checkId: number;
  title: string;
  section: string;
  owner: "developer" | "seo";
  /** Why it is listed as fixed. */
  reason: string;
}

export interface TaskStateRecord {
  status: TaskStatus;
  note?: string | null;
  updatedAt?: Date | string | null;
}

export interface AuditTaskList {
  generatedFrom: { auditRunAt: string | null; pagesCrawled: number; uploadedReport: string | null };
  tasks: AuditTask[];
  fixed: FixedItem[];
}

const PRIORITY: Record<ChecklistType, AuditTask["priority"]> = { ERROR: "high", WARNING: "medium", NOTICE: "low" };
const MAX_PAGES = 200;

export function buildAuditTasks(input: {
  ctx: OurContext;
  runAt: string | null;
  states: Map<number, TaskStateRecord>;
  uploaded: ComparedCheck[] | null;
  uploadedName: string | null;
}): AuditTaskList {
  const { ctx, states } = input;
  const audit = buildAuditContext({ origin: ctx.origin, crawls: ctx.crawls, siteChecks: ctx.siteChecks, linkStatuses: ctx.linkStatuses });
  const okPages = ctx.crawls.filter((c) => c.ok);
  const uploadedById = new Map((input.uploaded ?? []).map((c) => [c.id, c]));

  const tasks: AuditTask[] = [];
  const fixed: FixedItem[] = [];

  for (const check of SITE_AUDIT_CHECKS) {
    const guide = guideFor(check.id, check.name);
    const up = uploadedById.get(check.id);
    const inUploaded = Boolean(up && up.semrush.failed > 0);
    const result = OUR_CHECKS[check.id]?.(ctx) ?? null;
    const state = states.get(check.id);
    const base = {
      checkId: check.id,
      title: check.name,
      type: check.type,
      priority: PRIORITY[check.type],
      ...guide,
      inUploadedReport: inUploaded,
      status: (state?.status ?? "open") as TaskStatus,
      note: state?.note ?? null,
      updatedAt: state?.updatedAt ? new Date(state.updatedAt).toISOString() : null,
    };

    if (!result) {
      // This audit cannot measure it: keep what the uploaded report found, marked as not verifiable here.
      if (inUploaded && up) {
        tasks.push({
          ...base,
          ownerReason: null,
          scope: "page",
          sitewide: false,
          affectedPages: up.semrush.urls.map((u) => u.url).slice(0, MAX_PAGES),
          affectedTotal: up.semrush.urls.length || up.semrush.failed,
          pagesChecked: 0,
          evidence: ["Found by the uploaded report. This audit cannot check it, so it cannot confirm a fix: upload a fresh report after fixing."],
          source: "uploaded_only",
        });
      }
      continue;
    }

    const scope = result.scope === "site" ? "site" : "page";
    const flagged = scope === "site" ? result.found > 0 : result.urls.length > 0;

    if (!flagged) {
      if (state && state.status !== "open") fixed.push({ ...pick(base), reason: "Marked in progress or done, and the latest audit no longer finds it." });
      else if (inUploaded) fixed.push({ ...pick(base), reason: "The uploaded report found it; the latest audit no longer does." });
      continue;
    }

    const pages = scope === "page" ? result.urls : [];
    const sitewide = scope === "page" && okPages.length > 1 && pages.length / okPages.length >= SITEWIDE_SHARE;
    const entry = SEMRUSH_CATALOG[check.id];
    let owner = guide.owner;
    let ownerReason: string | null = null;
    if (entry?.templateWhenSitewide && sitewide && owner === "seo") {
      owner = "developer";
      ownerReason = `It is on ${pages.length} of ${okPages.length} pages, so it comes from the shared header, footer or template, not from each page's content.`;
    }
    const firstCrawl = scope === "page" ? ctx.crawls.find((c) => c.url === pages[0]) : undefined;
    const evidence = scope === "site" ? siteFacts(check.id, ctx.siteChecks as NonNullable<typeof ctx.siteChecks>) : firstCrawl ? evidenceFor(check.id, firstCrawl, audit) : [];
    tasks.push({
      ...base,
      owner,
      ownerReason,
      where: owner === guide.owner ? guide.where : "In the website's shared layout (header, footer or page template), fixed once for every page.",
      scope,
      sitewide,
      affectedPages: pages.slice(0, MAX_PAGES),
      affectedTotal: scope === "site" ? 1 : pages.length,
      pagesChecked: scope === "site" ? 1 : result.total,
      evidence: [...evidence, ...(evidence.length === 0 && result.note ? [result.note] : [])].slice(0, 4),
      source: "ours",
    });
  }

  const rank = { high: 0, medium: 1, low: 2 } as const;
  tasks.sort((a, b) => rank[a.priority] - rank[b.priority] || b.affectedTotal - a.affectedTotal || a.checkId - b.checkId);
  return {
    generatedFrom: { auditRunAt: input.runAt, pagesCrawled: ctx.crawls.length, uploadedReport: input.uploadedName },
    tasks,
    fixed,
  };
}

const pick = (b: { checkId: number; title: string; section: string; owner: "developer" | "seo" }): Omit<FixedItem, "reason"> => ({
  checkId: b.checkId,
  title: b.title,
  section: b.section,
  owner: b.owner,
});
