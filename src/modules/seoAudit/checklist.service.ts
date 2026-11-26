/**
 * The full site audit checklist for one route: every one of the 101 checks, in order, with what this audit found.
 *
 * Each result comes from the same check functions the audit report and the comparison use (one source of truth), so the
 * checklist can never disagree with them. A check the audit could not measure is shown as "Not measured" with the
 * reason, never as passed.
 */

import type { CrawlResult } from "./crawler.service";
import type { SiteChecks } from "./siteChecks.service";
import type { LinkStatusMap } from "./linkCheck.service";
import { SITE_AUDIT_CHECKS, type ChecklistType } from "./siteAuditCatalog";
import { OUR_CHECKS, evidenceFor, type OurContext } from "./semrushOurChecks";
import { ALL_CHECKS, CHECK_GROUPS, buildAuditContext, type CheckGroupKey } from "./siteAudit.checks";
import { GENERIC_FIX, SEMRUSH_CATALOG, plainFor } from "./semrushCatalog";
import type { PageSpeedSnapshot } from "./types";

export type ChecklistStatus = "passed" | "failed" | "warning" | "not_measured";

export interface ChecklistItem {
  id: number;
  name: string;
  /** Severity this check carries when it fails. */
  type: ChecklistType;
  status: ChecklistStatus;
  /** "page": the result is for this route. "site": the result is the same for the whole site. */
  scope: "page" | "site";
  summary: string;
  evidence?: string[];
  /** Which part of the audit this check belongs to, who fixes it, what it means, why it matters and how to fix it. */
  section: string;
  owner: "developer" | "seo";
  what: string;
  why: string;
  fix: string;
  /** Where in the admin or the website this gets fixed. */
  where: string;
  /** Every audited page where this problem was found (not only the selected route). Empty for site-wide checks. */
  affectedPages: string[];
  /** How many pages in all (affectedPages is capped). */
  affectedTotal: number;
}

/** Why a check has no result, for any checks that cannot be measured. */
const NOT_POSSIBLE: Record<number, string> = {};

const INTERACTIVE_LIMIT_MS = 3800;

/** Section of the checks that have no check definition of their own (they are measured in the report's earlier groups). */
const SECTION_OF: Record<number, CheckGroupKey> = {
  8: "links", 10: "security", 12: "links", 18: "crawlability", 20: "content", 27: "security", 30: "security", 32: "security",
  45: "content", 101: "content", 102: "content", 103: "content", 104: "content", 106: "content", 110: "content", 112: "content",
  114: "content", 115: "content", 124: "crawlability", 125: "crawlability", 126: "security", 203: "crawlability", 205: "security",
  206: "links", 207: "links", 208: "resources", 213: "links", 223: "content",
};

/** Where the fix is made, by the kind of check and who does it. */
export function whereToFix(section: string, owner: "developer" | "seo"): string {
  if (section === "Content & HTML") {
    return owner === "seo"
      ? "In the admin: Content Management > Pages, open the page and edit its heading, text or SEO fields (title, description)."
      : "In the website code: the page template or layout that builds this page's HTML.";
  }
  if (section === "Links & Redirects") return "In the page content, or in the header, footer or menu that repeats on every page (the website's shared layout).";
  if (section === "Security & Protocols") return "At the domain provider (DNS), the CDN or the hosting server settings, not inside the pages.";
  if (section === "Resources & Performance") return "In the website's build and hosting: image, script and style files, compression and caching settings.";
  if (section === "Crawlability & Indexing") return "In robots.txt, the sitemap, the page's canonical/noindex tags, or the server headers.";
  return "In the website code: the page head (hreflang, AMP tags).";
}

export const sectionName = (id: number): string => CHECK_GROUPS[ALL_CHECKS.find((d) => d.id === id)?.group ?? SECTION_OF[id] ?? "content"].name;

/** What the site probes measured, for the checks that are about the whole site. */
export function siteFacts(id: number, site: SiteChecks): string[] {
  switch (id) {
    case 10:
      return [`www answered: ${site.canonicalization.wwwStatus ?? "no answer"}${site.canonicalization.wwwError ? ` (${site.canonicalization.wwwError})` : ""}`];
    case 32:
      return site.httpRedirect ? [`http:// answered ${site.httpRedirect.status ?? "no response"}${site.httpRedirect.location ? ` → ${site.httpRedirect.location}` : ""}`] : [];
    case 205:
      return [`Strict-Transport-Security header: ${site.headers.hsts ?? "not sent"}`];
    case 125:
      return [`Sitemap: ${site.sitemap.error ?? "not reachable"}`];
    case 203:
      return [`robots.txt: ${site.robotsTxt.error ?? "not reachable"}`];
    case 27:
      return [`Certificate days remaining: ${site.tls.daysRemaining ?? "unknown"}`];
    default:
      return [];
  }
}

/** Section, owner, meaning, reason, fix and place of fix of one check. Fixed guidance, the same for every page. */
export function guideFor(id: number, name: string) {
  const entry = SEMRUSH_CATALOG[id];
  const fix = entry?.fix ?? GENERIC_FIX;
  const plain = plainFor(id, name, fix);
  const section = sectionName(id);
  const owner: "developer" | "seo" = entry?.owner ?? "developer";
  return { section, owner, what: plain.plain, why: plain.why, fix, where: whereToFix(section, owner) };
}

export function buildChecklist(input: {
  crawl: CrawlResult;
  origin: string;
  crawls: CrawlResult[];
  siteChecks: SiteChecks;
  linkStatuses?: LinkStatusMap | null;
  pageSpeed?: PageSpeedSnapshot | null;
}): ChecklistItem[] {
  const { crawl, origin, crawls, siteChecks } = input;
  const ctx: OurContext = { origin, crawls, siteChecks, linkStatuses: input.linkStatuses ?? null };
  const audit = buildAuditContext({ origin, crawls, siteChecks, linkStatuses: input.linkStatuses });
  const routePath = (() => {
    try {
      return new URL(crawl.url).pathname;
    } catch {
      return "/";
    }
  })();

  return SITE_AUDIT_CHECKS.map((check): ChecklistItem => {
    const item = measure(check);
    // Where else on the site this problem is: every audited page it was found on, whichever route is selected.
    const found = item.status === "not_measured" || item.scope === "site" ? [] : (OUR_CHECKS[check.id]?.(ctx)?.urls ?? []);
    const guide = plainFor(check.id, check.name, SEMRUSH_CATALOG[check.id]?.fix ?? GENERIC_FIX);
    return {
      ...item,
      section: sectionName(check.id),
      owner: SEMRUSH_CATALOG[check.id]?.owner ?? "developer",
      what: guide.plain,
      why: guide.why,
      fix: SEMRUSH_CATALOG[check.id]?.fix ?? GENERIC_FIX,
      where: whereToFix(sectionName(check.id), SEMRUSH_CATALOG[check.id]?.owner ?? "developer"),
      affectedPages: found.slice(0, 100),
      affectedTotal: found.length,
    };
  });

  function measure(check: (typeof SITE_AUDIT_CHECKS)[number]): Omit<ChecklistItem, "section" | "owner" | "what" | "why" | "fix" | "where" | "affectedPages" | "affectedTotal"> {
    const failLevel: ChecklistStatus = check.type === "ERROR" ? "failed" : "warning";
    const entry = SEMRUSH_CATALOG[check.id];
    const base = { id: check.id, name: check.name, type: check.type };

    // Time to Interactive comes from the PageSpeed run, which exists for one page only.
    if (check.id === 208) {
      const ps = input.pageSpeed;
      let samePage = false;
      try {
        samePage = Boolean(ps?.ok) && new URL(ps!.url).pathname.replace(/\/+$/, "") === routePath.replace(/\/+$/, "");
      } catch {
        samePage = false;
      }
      const tti = ps?.metrics?.ttiMs;
      if (!samePage || tti == null) {
        return { ...base, status: "not_measured", scope: "page", summary: "Measured only for the page that has a PageSpeed run, and only by an audit run after this was added." };
      }
      return tti > INTERACTIVE_LIMIT_MS
        ? { ...base, status: failLevel, scope: "page", summary: `The page becomes interactive after ${(tti / 1000).toFixed(1)}s (over ${INTERACTIVE_LIMIT_MS / 1000}s).` }
        : { ...base, status: "passed", scope: "page", summary: `The page becomes interactive after ${(tti / 1000).toFixed(1)}s.` };
    }

    const evaluator = OUR_CHECKS[check.id];
    if (!evaluator) {
      return { ...base, status: "not_measured", scope: "page", summary: NOT_POSSIBLE[check.id] ?? "This audit has no check for it." };
    }
    const result = evaluator(ctx);
    if (!result) {
      return { ...base, status: "not_measured", scope: "page", summary: "The stored audit did not collect the data for this check. Run Re-Audit Page." };
    }

    const scope = result.scope === "site" ? "site" : "page";
    const flagged = scope === "site" ? result.found > 0 : result.urls.includes(crawl.url);
    if (!flagged) {
      return {
        ...base,
        status: "passed",
        scope,
        summary: scope === "site" ? "No problem found." : `No problem found on this page (${result.total} page(s) checked in this audit).`,
      };
    }

    const lines = scope === "page" ? evidenceFor(check.id, crawl, audit) : siteFacts(check.id, siteChecks);
    const plain = plainFor(check.id, check.name, entry?.fix ?? "").plain;
    const evidence = [...lines, ...(result.note && lines.length === 0 ? [result.note] : [])];
    return {
      ...base,
      status: failLevel,
      scope,
      summary: plain,
      evidence: evidence.length > 0 ? evidence.slice(0, 5) : undefined,
    };
  }
}
