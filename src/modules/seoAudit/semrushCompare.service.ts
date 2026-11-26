/**
 * Puts a Semrush Site Audit export next to OUR audit's last run, and turns the differences into a task list.
 *
 * Pure functions of (the imported Semrush files, the stored crawl): the same inputs always give the same report.
 * Nothing is fetched here, and nothing is shown that is not in the Semrush files or in our audit's stored crawl.
 */

import { GENERIC_FIX, SEMRUSH_CATALOG, SITEWIDE_SHARE, plainFor, type TaskOwner } from "./semrushCatalog";
import { normalizeName, type SemrushIssue, type SemrushIssueType, type SemrushPage } from "./semrushCsv.service";
import { OUR_CHECKS, evidenceFor, urlKey, type OurContext, type OurResult } from "./semrushOurChecks";
import { buildAuditContext } from "./siteAudit.checks";
import { guideFor } from "./checklist.service";

export type OursStatus = "found" | "clean" | "not_checked" | "not_measured" | "no_audit";
export type Verdict =
  /** Semrush and our audit both report it. */
  | "both"
  /** Semrush reports it; our audit has the check but found nothing. */
  | "semrush_only"
  /** Semrush reports it; our audit has no such check (or could not measure it). */
  | "not_checked"
  /** Our audit reports it; Semrush's check passed. */
  | "ours_only"
  /** Neither reports it. */
  | "clean";

export type UrlOurs = "flagged" | "clean" | "not_crawled" | "n/a";

export interface ComparedUrl {
  url: string;
  count: number;
  ours: UrlOurs;
  /** What our own crawl saw on this page for this check (empty when it was not crawled or has nothing to add). */
  evidence: string[];
}

export interface ComparedCheck {
  id: number;
  name: string;
  type: SemrushIssueType;
  owner: TaskOwner;
  ownerReason: string | null;
  fix: string;
  /** What is wrong, and why it matters, in plain words. */
  plain: string;
  why: string;
  /** The audit section it belongs to and where it is fixed. */
  section: string;
  where: string;
  semrush: {
    failed: number;
    total: number;
    changed: number;
    /** Share of the pages in the Semrush crawl that have it. Null without the mega export. */
    pageShare: number | null;
    sitewide: boolean;
    urls: ComparedUrl[];
    urlsTruncated: boolean;
  };
  ours: { status: OursStatus; found: number; total: number; note: string | null; urls: string[] };
  verdict: Verdict;
}

export interface SemrushComparison {
  importId: string;
  uploadedAt: string;
  issuesFileName: string | null;
  pagesFileName: string | null;
  semrush: {
    checks: number;
    failing: number;
    errors: number;
    warnings: number;
    notices: number;
    /** Pages in the mega export; null when only the issues file was uploaded. */
    pages: number | null;
  };
  ours: {
    available: boolean;
    runAt: string | null;
    pagesCrawled: number;
    /** How many of Semrush's checks our audit has an equivalent for. */
    checksCovered: number;
    /** Semrush pages (from the mega export) that our audit did not crawl. */
    semrushPagesNotCrawled: number | null;
  };
  counts: Record<Verdict, number>;
  checks: ComparedCheck[];
}

export type TaskStatus = "open" | "in_progress" | "done";

export interface TaskState {
  status: TaskStatus;
  note?: string | null;
  updatedAt?: string;
  updatedBy?: string | null;
}

/**
 * Whether our own latest audit still sees the problem. This is what lets a task close itself once the site is fixed
 * and "Re-Audit Page" has been run, without uploading a new report.
 */
export interface LiveState {
  state: "fixed" | "still" | "partly" | "unverified";
  stillPages: number;
  fixedPages: number;
  note: string;
}

export interface FixTask {
  issueId: number;
  title: string;
  owner: TaskOwner;
  ownerReason: string | null;
  priority: "high" | "medium" | "low";
  whatToDo: string;
  affectedPages: number;
  urls: string[];
  foundBy: Array<"semrush" | "our_audit">;
  semrushType: SemrushIssueType;
  live: LiveState;
  status: TaskStatus;
  note: string | null;
  updatedAt: string | null;
}

export interface SemrushImportData {
  id: string;
  createdAt: Date | string;
  issuesFileName?: string | null;
  pagesFileName?: string | null;
  issues: SemrushIssue[];
  pages: SemrushPage[] | null;
}

export interface AuditInput extends OurContext {
  runAt: string | null;
}

const MAX_URLS_PER_CHECK = 200;
const MAX_URLS_PER_TASK = 25;

const PRIORITY: Record<SemrushIssueType, FixTask["priority"]> = { ERROR: "high", WARNING: "medium", NOTICE: "low" };
const TYPE_ORDER: Record<SemrushIssueType, number> = { ERROR: 0, WARNING: 1, NOTICE: 2 };
const VERDICT_ORDER: Record<Verdict, number> = { both: 0, semrush_only: 1, not_checked: 2, ours_only: 3, clean: 4 };

function oursStatus(result: OurResult | null | undefined, hasCheck: boolean, hasAudit: boolean): OursStatus {
  if (!hasAudit) return "no_audit";
  if (!hasCheck) return "not_checked";
  if (!result) return "not_measured";
  return result.found > 0 ? "found" : "clean";
}

function verdictFor(semrushFailed: number, ours: OursStatus): Verdict {
  if (semrushFailed > 0) {
    if (ours === "found") return "both";
    if (ours === "clean") return "semrush_only";
    return "not_checked";
  }
  return ours === "found" ? "ours_only" : "clean";
}

export function buildSemrushComparison(data: SemrushImportData, audit: AuditInput | null): SemrushComparison {
  const pages = data.pages;
  const pageCount = pages ? pages.length : null;

  // Semrush URLs per check, by the check's normalized name (the mega export only has names, not ids).
  const urlsByCheck = new Map<string, ComparedUrl[]>();
  for (const page of pages ?? []) {
    for (const issue of page.issues) {
      const key = normalizeName(issue.name);
      urlsByCheck.set(key, [...(urlsByCheck.get(key) ?? []), { url: page.url, count: issue.count, ours: "n/a", evidence: [] }]);
    }
  }

  const crawledKeys = new Set((audit?.crawls ?? []).map((c) => urlKey(c.url)));
  const auditCtx = audit ? buildAuditContext({ origin: audit.origin, crawls: audit.crawls, siteChecks: audit.siteChecks, linkStatuses: audit.linkStatuses }) : undefined;
  const crawlByKey = new Map((audit?.crawls ?? []).filter((c) => c.ok).map((c) => [urlKey(c.url), c] as const));
  const checks: ComparedCheck[] = [];
  let covered = 0;

  for (const issue of data.issues) {
    const evaluator = OUR_CHECKS[issue.id];
    const result = audit && evaluator ? evaluator(audit) : null;
    if (evaluator) covered += 1;
    const status = oursStatus(result, Boolean(evaluator), Boolean(audit));
    const verdict = verdictFor(issue.failed, status);

    const flaggedKeys = new Set((result?.urls ?? []).map(urlKey));
    const pageLevel = result ? result.scope !== "site" : false;
    const allUrls = (urlsByCheck.get(normalizeName(issue.name)) ?? []).map<ComparedUrl>((u) => {
      let ours: UrlOurs = "n/a";
      if (pageLevel) {
        const key = urlKey(u.url);
        ours = !crawledKeys.has(key) ? "not_crawled" : flaggedKeys.has(key) ? "flagged" : "clean";
      }
      const crawled = crawlByKey.get(urlKey(u.url));
      return { ...u, ours, evidence: crawled ? evidenceFor(issue.id, crawled, auditCtx) : [] };
    });
    allUrls.sort((a, b) => b.count - a.count || a.url.localeCompare(b.url));

    const pageShare = pageCount && pageCount > 0 && pages ? allUrls.length / pageCount : null;
    const sitewide = pageShare !== null && pageShare >= SITEWIDE_SHARE && allUrls.length > 1;

    const entry = SEMRUSH_CATALOG[issue.id];
    let owner: TaskOwner = entry?.owner ?? (issue.type === "ERROR" ? "developer" : "seo");
    let ownerReason: string | null = null;
    if (entry?.templateWhenSitewide && sitewide && owner === "seo") {
      owner = "developer";
      ownerReason = `It is on ${allUrls.length} of ${pageCount} pages, so it comes from the shared header, footer or page template, not from each page's content.`;
    }

    checks.push({
      id: issue.id,
      name: issue.name,
      type: issue.type,
      owner,
      ownerReason,
      fix: entry?.fix ?? GENERIC_FIX,
      ...plainFor(issue.id, issue.name, entry?.fix ?? GENERIC_FIX),
      section: guideFor(issue.id, issue.name).section,
      where: guideFor(issue.id, issue.name).where,
      semrush: {
        failed: issue.failed,
        total: issue.total,
        changed: issue.changed,
        pageShare,
        sitewide,
        urls: allUrls.slice(0, MAX_URLS_PER_CHECK),
        urlsTruncated: allUrls.length > MAX_URLS_PER_CHECK,
      },
      ours: {
        status,
        found: result?.found ?? 0,
        total: result?.total ?? 0,
        note: result?.note ?? null,
        urls: (result?.urls ?? []).slice(0, MAX_URLS_PER_CHECK),
      },
      verdict,
    });
  }

  checks.sort(
    (a, b) =>
      VERDICT_ORDER[a.verdict] - VERDICT_ORDER[b.verdict] ||
      TYPE_ORDER[a.type] - TYPE_ORDER[b.type] ||
      b.semrush.failed - a.semrush.failed ||
      a.id - b.id,
  );

  const counts: Record<Verdict, number> = { both: 0, semrush_only: 0, not_checked: 0, ours_only: 0, clean: 0 };
  for (const check of checks) counts[check.verdict] += 1;

  const failing = data.issues.filter((i) => i.failed > 0);
  const semrushUrlKeys = pages ? new Set(pages.map((p) => urlKey(p.url))) : null;
  const notCrawled = semrushUrlKeys && audit ? Array.from(semrushUrlKeys).filter((k) => !crawledKeys.has(k)).length : null;

  return {
    importId: data.id,
    uploadedAt: new Date(data.createdAt).toISOString(),
    issuesFileName: data.issuesFileName ?? null,
    pagesFileName: data.pagesFileName ?? null,
    semrush: {
      checks: data.issues.length,
      failing: failing.length,
      errors: failing.filter((i) => i.type === "ERROR").length,
      warnings: failing.filter((i) => i.type === "WARNING").length,
      notices: failing.filter((i) => i.type === "NOTICE").length,
      pages: pageCount,
    },
    ours: {
      available: Boolean(audit),
      runAt: audit?.runAt ?? null,
      pagesCrawled: audit?.crawls.length ?? 0,
      checksCovered: covered,
      semrushPagesNotCrawled: notCrawled,
    },
    counts,
    checks,
  };
}

function liveStateOf(check: ComparedCheck, auditAvailable: boolean): LiveState {
  if (!auditAvailable) {
    return { state: "unverified", stillPages: 0, fixedPages: 0, note: "Run an audit in tab 1 to see whether this is fixed." };
  }
  const urls = check.semrush.urls;
  const still = urls.filter((u) => u.ours === "flagged").length;
  const fixed = urls.filter((u) => u.ours === "clean").length;
  if (check.ours.status === "found") {
    return still > 0 && fixed > 0
      ? { state: "partly", stillPages: still, fixedPages: fixed, note: `Our latest audit still finds it on ${still} page(s); ${fixed} are fixed.` }
      : { state: "still", stillPages: still || check.ours.found, fixedPages: 0, note: `Our latest audit still finds it${check.ours.total > 1 ? ` (${check.ours.found} of ${check.ours.total})` : ""}.` };
  }
  if (check.ours.status === "clean") {
    return { state: "fixed", stillPages: 0, fixedPages: fixed || check.semrush.failed, note: "Our latest audit no longer finds it." };
  }
  return { state: "unverified", stillPages: 0, fixedPages: 0, note: "Our audit cannot check this. Upload a fresh report after fixing to confirm." };
}

/** One task per check that either audit reports, split between the developer and the SEO owner. */
export function buildFixTasks(comparison: SemrushComparison, states: Record<string, TaskState> | undefined): FixTask[] {
  const tasks: FixTask[] = [];
  for (const check of comparison.checks) {
    if (check.verdict === "clean") continue;
    const foundBySemrush = check.semrush.failed > 0;
    const foundByOurs = check.ours.status === "found";
    const state = states?.[String(check.id)];
    const semrushUrls = check.semrush.urls.map((u) => u.url);
    const urls = (semrushUrls.length > 0 ? semrushUrls : check.ours.urls).slice(0, MAX_URLS_PER_TASK);
    tasks.push({
      issueId: check.id,
      title: check.name,
      owner: check.owner,
      ownerReason: check.ownerReason,
      priority: PRIORITY[check.type],
      whatToDo: check.fix,
      // Pages when the mega export listed them, otherwise Semrush's own count of failed checks.
      affectedPages: foundBySemrush ? (check.semrush.urls.length > 0 ? check.semrush.urls.length : check.semrush.failed) : check.ours.found,
      urls,
      foundBy: [...(foundBySemrush ? (["semrush"] as const) : []), ...(foundByOurs ? (["our_audit"] as const) : [])],
      semrushType: check.type,
      live: liveStateOf(check, comparison.ours.available),
      status: state?.status ?? "open",
      note: state?.note ?? null,
      updatedAt: state?.updatedAt ?? null,
    });
  }
  const rank = { high: 0, medium: 1, low: 2 } as const;
  tasks.sort((a, b) => rank[a.priority] - rank[b.priority] || b.affectedPages - a.affectedPages || a.issueId - b.issueId);
  return tasks;
}
