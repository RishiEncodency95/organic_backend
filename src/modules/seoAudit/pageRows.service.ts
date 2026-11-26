import SeoAuditSnapshot from "../../models/seoAudit.model";
import type { CrawlResult } from "./crawler.service";
import type { GscResult } from "./gsc.service";
import type { SiteChecks } from "./siteChecks.service";
import type { PageSpeedSnapshot, SeoCheckupReportData } from "./types";
import {
  DESC_MAX,
  DESC_MIN,
  SCORE_CHECKS,
  TITLE_MAX,
  TITLE_MIN,
  computeRouteScore,
  pageFindings,
  type RecommendationPriority,
} from "./pageFindings.service";

/**
 * Turns the crawl stored by the last audit into the rows and the detail pages the admin shows.
 *
 * Everything here is read off the crawl (or the sitemap, Search Console and PageSpeed data saved
 * with it). A value the audit cannot measure is reported as "not available" / null, never as a
 * reassuring default, so a page is never shown as "valid" or "orphan" without evidence.
 */

export interface AuditSnapshot {
  report: SeoCheckupReportData;
  crawls: CrawlResult[];
  siteChecks: SiteChecks | null;
  gsc: GscResult | null;
  pageSpeed: PageSpeedSnapshot | null;
  createdAt?: Date;
}

interface Incoming {
  source: string;
  anchorText: string;
  isNofollow: boolean;
}

const bareHost = (host: string) => host.toLowerCase().replace(/^www\./, "");

/** "/about/" -> "/about", "/" stays "/" */
const cleanPath = (pathname: string) => pathname.replace(/\/+$/, "") || "/";

/** Path of `href` when it points at the audited site, else null. */
function sitePath(href: string, origin: string): string | null {
  try {
    const url = new URL(href, origin);
    if (bareHost(url.hostname) !== bareHost(new URL(origin).hostname)) return null;
    return cleanPath(url.pathname);
  } catch {
    return null;
  }
}

const idFor = (path: string) => (path === "/" ? "home" : path.replace(/^\//, "").replace(/\/$/, ""));

const toNumber = (value: string | null | undefined): number | null => {
  if (value == null || value === "") return null;
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const SEVERITY: Record<RecommendationPriority, "critical" | "warning" | "notice"> = {
  high: "critical",
  medium: "warning",
  low: "notice",
};

interface Context {
  snapshot: AuditSnapshot;
  origin: string;
  byPath: Map<string, CrawlResult>;
  incoming: Map<string, Incoming[]>;
  sitemapPaths: Set<string>;
}

function buildContext(snapshot: AuditSnapshot): Context {
  const origin = snapshot.report?.site?.origin || snapshot.crawls[0]?.url || "";
  const byPath = new Map<string, CrawlResult>();
  for (const crawl of snapshot.crawls) byPath.set(cleanPath(crawl.requestedPath), crawl);

  // Who links to whom, among the pages this audit crawled.
  const incoming = new Map<string, Incoming[]>();
  for (const crawl of snapshot.crawls) {
    if (!crawl.ok) continue;
    const self = cleanPath(crawl.requestedPath);
    const seen = new Set<string>();
    for (const link of crawl.links ?? []) {
      if (!link.isInternal) continue;
      const target = sitePath(link.href, origin);
      if (!target || target === self || seen.has(target)) continue;
      seen.add(target);
      const list = incoming.get(target) ?? [];
      list.push({ source: crawl.url, anchorText: link.anchorText, isNofollow: link.isNofollow });
      incoming.set(target, list);
    }
  }

  const sitemapPaths = new Set<string>();
  for (const entry of snapshot.siteChecks?.sitemap?.entries ?? []) {
    const path = sitePath(entry.loc, origin);
    if (path) sitemapPaths.add(path);
  }
  return { snapshot, origin, byPath, incoming, sitemapPaths };
}

const statusClass = (status: number | null) => (status == null ? "unchecked" : `${Math.floor(status / 100)}xx`);

function ogStatus(tags: Record<string, string | null> | undefined): "valid" | "incomplete" | "not_available" {
  const have = ["og:title", "og:description", "og:image"].filter((key) => tags?.[key]).length;
  return have === 3 ? "valid" : have === 0 ? "not_available" : "incomplete";
}

function twitterStatus(tags: Record<string, string | null> | undefined): "valid" | "incomplete" | "not_available" {
  const have = ["twitter:card", "twitter:title", "twitter:image"].filter((key) => tags?.[key]).length;
  return have === 3 ? "valid" : have === 0 ? "not_available" : "incomplete";
}

/** Outgoing links with the status of those that point at another crawled page. */
function outgoingLinks(crawl: CrawlResult, ctx: Context) {
  const seen = new Set<string>();
  const out: Array<{
    target: string;
    normalizedTarget: string;
    anchorText: string;
    rel: string | null;
    isInternal: boolean;
    isNofollow: boolean;
    httpStatus: number | null;
    statusClass: string;
    isBroken: boolean;
    redirectsTo: string | null;
    redirectHops: number;
  }> = [];
  for (const link of crawl.links ?? []) {
    const key = `${link.href}|${link.anchorText}`;
    if (seen.has(key)) continue;
    seen.add(key);
    // Only a link to a page this audit also fetched has a known status; the rest were not checked.
    const targetPath = link.isInternal ? sitePath(link.href, ctx.origin) : null;
    const known = targetPath ? ctx.byPath.get(targetPath) : undefined;
    const httpStatus = known ? known.httpStatus || null : null;
    out.push({
      target: link.rawHref || link.href,
      normalizedTarget: link.href,
      anchorText: link.anchorText,
      rel: link.rel,
      isInternal: link.isInternal,
      isNofollow: link.isNofollow,
      httpStatus,
      statusClass: statusClass(httpStatus),
      isBroken: httpStatus != null && httpStatus >= 400,
      redirectsTo: null,
      redirectHops: 0,
    });
  }
  return out;
}

function pageSpeedFor(crawl: CrawlResult, ctx: Context): PageSpeedSnapshot | null {
  const ps = ctx.snapshot.pageSpeed;
  if (!ps) return null;
  const path = sitePath(ps.url, ctx.origin);
  return path === cleanPath(crawl.requestedPath) ? ps : null;
}

function searchFor(crawl: CrawlResult, ctx: Context) {
  const gsc = ctx.snapshot.gsc;
  if (!gsc?.available) return null;
  const want = cleanPath(crawl.requestedPath);
  const row = gsc.pages.find((page) => sitePath(page.page, ctx.origin) === want);
  if (!row) return null;
  return { clicks: row.clicks, impressions: row.impressions, ctr: row.ctr, position: row.position, updatedAt: gsc.fetchedAt };
}

function headingLevelsSkipped(crawl: CrawlResult): boolean {
  let previous = 0;
  for (const heading of crawl.headingSequence ?? []) {
    if (previous > 0 && heading.level > previous + 1) return true;
    previous = heading.level;
  }
  return false;
}

/* ----------------------------------------------------------------------------------------- */
/* Rows                                                                                       */
/* ----------------------------------------------------------------------------------------- */

function rowFor(crawl: CrawlResult, ctx: Context) {
  const { items } = pageFindings(crawl);
  const path = cleanPath(crawl.requestedPath);
  const title = (crawl.title || "").replace(/^<title>|<\/title>$/gi, "");
  const desc = crawl.metaDescription || "";
  const inbound = ctx.incoming.get(path) ?? [];
  const outgoing = outgoingLinks(crawl, ctx);
  const ps = pageSpeedFor(crawl, ctx);
  const cdn = ctx.snapshot.siteChecks?.headers?.cdnIndicators ?? [];
  const skipped = headingLevelsSkipped(crawl);
  const h1Status = crawl.h1.length === 0 ? "missing" : crawl.h1.length > 1 ? "multiple" : skipped ? "hierarchy_warning" : "ok";
  const issueCounts = {
    critical: items.filter((i) => i.priority === "high").length,
    warning: items.filter((i) => i.priority === "medium").length,
    notice: items.filter((i) => i.priority === "low").length,
    total: items.length,
  };

  return {
    id: idFor(path),
    url: crawl.url,
    path: crawl.requestedPath,
    title: title || null,
    titleLength: title.length,
    titleStatus: !title ? "missing" : title.length < TITLE_MIN ? "too_short" : title.length > TITLE_MAX ? "too_long" : "ok",
    metaDescription: desc || null,
    metaDescriptionLength: desc.length,
    descriptionStatus: !desc ? "missing" : desc.length < DESC_MIN ? "too_short" : desc.length > DESC_MAX ? "too_long" : "ok",
    httpStatus: crawl.httpStatus || null,
    indexable: crawl.indexable,
    indexabilityReason: crawl.indexable ? null : crawl.robotsMeta || (crawl.ok ? "noindex directive" : "the page could not be fetched"),
    canonical: crawl.canonical,
    canonicalStatus: crawl.canonicalStatus,
    score: computeRouteScore(crawl),
    issueCounts,
    issueCategories: Array.from(new Set(items.map((i) => i.category))),
    h1: crawl.h1,
    h1Status,
    hierarchyStatus: crawl.h1.length !== 1 ? "hierarchy_error" : skipped ? "hierarchy_warning" : "ok",
    headingCounts: { h1: crawl.h1.length, h2: crawl.h2.length, h3: crawl.h3.length },
    wordCount: crawl.wordCount,
    inLinks: inbound.length,
    outLinks: crawl.internalLinksUnique + crawl.externalLinksUnique,
    brokenLinks: new Set(outgoing.filter((l) => l.isBroken).map((l) => l.normalizedTarget)).size,
    depth: path === "/" ? 0 : path.split("/").filter(Boolean).length,
    // Only meaningful for pages other than the home page, and only among the pages this audit crawled.
    isOrphan: crawl.ok && path !== "/" && inbound.length === 0,
    inSitemap: ctx.sitemapPaths.has(path),
    schemaTypes: crawl.jsonLdTypes ?? [],
    schemaStatus:
      crawl.jsonLdBlocks === 0
        ? "none"
        : !crawl.jsonLdValid
          ? "invalid"
          : (crawl.jsonLdTypes ?? []).includes("BreadcrumbList")
            ? "valid_with_breadcrumb"
            : "valid",
    imageCount: crawl.images.length,
    imagesMissingAlt: crawl.imagesMissingAlt.length,
    responseTimeMs: crawl.ok ? crawl.ttfbMs : null,
    // No target keywords are configured, and pages are not rendered in a browser: say "not measured".
    keywordStatus: "not_available" as const,
    openGraphStatus: ogStatus(crawl.openGraph),
    twitterStatus: twitterStatus(crawl.twitter),
    consoleErrorCount: 0,
    failedRequestCount: 0,
    renderBlockingCount: crawl.syncHeadScripts ?? 0,
    cdnStatus: !ctx.snapshot.siteChecks ? "unable_to_determine" : cdn.length > 0 ? "detected" : "no_indicators",
    performance: ps?.ok
      ? { score: ps.scores.performance, lcpMs: ps.metrics.lcpMs, cls: ps.metrics.cls, isFieldData: ps.fieldData.available, fetchedAt: ps.fetchedAt }
      : { score: null, lcpMs: null, cls: null, isFieldData: false, fetchedAt: null },
    search: searchFor(crawl, ctx),
    analytics: null,
    lastCrawledAt: crawl.fetchedAt,
  };
}

export type PageRow = ReturnType<typeof rowFor>;

/** One row per crawled page. */
export function buildPageRows(snapshot: AuditSnapshot): PageRow[] {
  const ctx = buildContext(snapshot);
  return snapshot.crawls.map((crawl) => rowFor(crawl, ctx));
}

/* ----------------------------------------------------------------------------------------- */
/* Detail                                                                                     */
/* ----------------------------------------------------------------------------------------- */

/** The page's earlier results, from the audits kept in the database (newest first). */
async function historyFor(path: string) {
  const rows = await SeoAuditSnapshot.aggregate([
    { $sort: { createdAt: -1 } },
    { $limit: 10 },
    {
      $project: {
        createdAt: 1,
        crawl: { $arrayElemAt: [{ $filter: { input: "$crawls", as: "c", cond: { $eq: ["$$c.requestedPath", path] } } }, 0] },
      },
    },
  ]);
  return (rows as Array<{ createdAt: Date; crawl?: CrawlResult }>)
    .filter((row) => row.crawl)
    .map((row) => {
      const crawl = row.crawl as CrawlResult;
      const { items } = pageFindings(crawl);
      return {
        capturedAt: new Date(row.createdAt).toISOString(),
        score: computeRouteScore(crawl),
        issueCounts: {
          critical: items.filter((i) => i.priority === "high").length,
          warning: items.filter((i) => i.priority === "medium").length,
          notice: items.filter((i) => i.priority === "low").length,
          total: items.length,
        },
        wordCount: crawl.wordCount,
        httpStatus: crawl.httpStatus || null,
        performanceScore: null,
        lcpMs: null,
        cls: null,
        clicks: null,
        impressions: null,
        position: null,
      };
    })
    .reverse();
}

/** The full detail of one route, or null when the route was not part of the audit. */
export async function buildPageDetail(snapshot: AuditSnapshot, wantedId: string) {
  const ctx = buildContext(snapshot);
  const wanted = wantedId.toLowerCase().trim();
  const crawl = snapshot.crawls.find((c) => {
    const path = cleanPath(c.requestedPath);
    return idFor(path).toLowerCase() === wanted || path.replace(/^\//, "").toLowerCase() === wanted;
  });
  if (!crawl) return null;

  const row = rowFor(crawl, ctx);
  const path = cleanPath(crawl.requestedPath);
  const { items } = pageFindings(crawl);
  const outgoing = outgoingLinks(crawl, ctx);
  const inbound = ctx.incoming.get(path) ?? [];
  const ps = pageSpeedFor(crawl, ctx);
  const og = crawl.openGraph ?? {};
  const tw = crawl.twitter ?? {};
  const headers = snapshot.siteChecks?.headers;
  const redirected = Boolean(crawl.finalUrl) && cleanPath(new URL(crawl.finalUrl, crawl.url).pathname) !== path;
  const pagePs = ps?.ok ? ps : null;

  return {
    page: {
      ...row,
      metaRobots: crawl.robotsMeta,
      canonicalNormalized: crawl.canonical,
      canonicalCount: crawl.canonicalCount,
      ogTitle: og["og:title"] ?? null,
      ogDescription: og["og:description"] ?? null,
      ogImage: og["og:image"] ?? null,
      ogType: og["og:type"] ?? null,
      ogUrl: og["og:url"] ?? null,
      twitterCard: tw["twitter:card"] ?? null,
      twitterTitle: tw["twitter:title"] ?? null,
      twitterDescription: tw["twitter:description"] ?? null,
      twitterImage: tw["twitter:image"] ?? null,
      metaKeywords: crawl.metaKeywords,
      metaKeywordCount: crawl.metaKeywords ? crawl.metaKeywords.split(",").filter((k) => k.trim()).length : 0,
      socialStatus: { openGraph: row.openGraphStatus, twitter: row.twitterStatus },
      keywordAnalysis: { available: false, targets: [] },
      // The audit reads the HTML the server sends; it does not run the page in a browser.
      browserHealth: { consoleErrors: [], consoleWarnings: [], jsExceptions: [], failedRequests: [] },
      cdn: {
        status: row.cdnStatus,
        provider: headers?.cdnIndicators?.[0] ?? null,
        evidence: headers?.cdnIndicators ?? [],
        cacheControl: null,
        server: headers?.server ?? null,
      },
      lang: crawl.htmlLang,
      viewport: crawl.viewport,
      hreflang: crawl.hreflang ?? [],
      headingSequence: crawl.headingSequence ?? [],
      headingIssues: [
        ...(crawl.h1.length === 0 ? ["No H1 on the page"] : []),
        ...(crawl.h1.length > 1 ? [`${crawl.h1.length} H1 headings on the page`] : []),
        ...(headingLevelsSkipped(crawl) ? ["A heading level is skipped (for example H2 followed by H4)"] : []),
      ],
      h2: crawl.h2,
      h3: crawl.h3,
      images: crawl.images.map((image) => ({
        src: image.src ?? "",
        alt: image.alt,
        hasAlt: image.hasAlt,
        isDecorative: image.alt === "",
        loading: image.loading,
        width: toNumber(image.width),
        height: toNumber(image.height),
      })),
      imagesEmptyAlt: crawl.images.filter((image) => image.alt === "").length,
      imagesLazyLoaded: crawl.images.filter((image) => image.loading === "lazy").length,
      imagesWithoutDimensions: crawl.imagesMissingDims.length,
      schemas:
        crawl.jsonLdBlocks === 0
          ? []
          : [{ types: crawl.jsonLdTypes ?? [], valid: crawl.jsonLdValid, errors: crawl.jsonLdError ? [crawl.jsonLdError] : [], warnings: [] }],
      breadcrumbIssues: [],
      // The checks the page score is made of, so the score can be explained.
      scoreBreakdown: SCORE_CHECKS.map((check) => ({
        category: check.category,
        score: check.passes(crawl) ? 100 : 0,
        weight: check.weight / SCORE_CHECKS.reduce((sum, c) => sum + c.weight, 0),
      })),
      contentType: "text/html",
      finalUrl: crawl.finalUrl || null,
      redirected,
      fetchError: crawl.error,
      renderedWithJs: false,
      internalLinkCount: crawl.internalLinksUnique,
      externalLinkCount: crawl.externalLinksUnique,
      nofollowLinkCount: crawl.nofollowLinks,
      mixedContentLinkCount: crawl.mixedContent?.length ?? 0,
    },
    issues: items.map((entry) => ({
      id: `${row.id}:${entry.ruleId}`,
      ruleId: entry.ruleId,
      category: entry.category,
      severity: SEVERITY[entry.priority],
      title: entry.title,
      detail: `${entry.whyItMatters} ${entry.recommendedFix}`.trim(),
      evidence: {},
      url: crawl.url,
      scope: "page",
      firstSeenAt: crawl.fetchedAt,
      lastSeenAt: crawl.fetchedAt,
    })),
    links: {
      incoming: inbound,
      outgoing,
      brokenOutgoing: outgoing.filter((l) => l.isBroken).length,
      redirectingOutgoing: 0,
    },
    redirectChain: redirected
      ? {
          hops: [
            { url: crawl.url, status: null },
            { url: crawl.finalUrl, status: crawl.httpStatus || null },
          ],
          hopCount: 1,
          finalUrl: crawl.finalUrl,
          finalStatus: crawl.httpStatus || null,
          severity: "warning",
          issues: [`The address redirects to ${crawl.finalUrl}`],
        }
      : null,
    performance: {
      audits: pagePs
        ? [
            {
              id: `lighthouse-${pagePs.strategy}`,
              strategy: pagePs.strategy,
              status: "completed",
              error: null,
              lighthouseVersion: null,
              lab: {
                performance: pagePs.scores.performance,
                accessibility: pagePs.scores.accessibility,
                bestPractices: pagePs.scores.bestPractices,
                seo: pagePs.scores.seo,
                fcpMs: pagePs.metrics.fcpMs,
                lcpMs: pagePs.metrics.lcpMs,
                tbtMs: pagePs.metrics.tbtMs,
                cls: pagePs.metrics.cls,
                siMs: pagePs.metrics.siMs,
              },
              field: { available: pagePs.fieldData.available, source: "chrome-ux-report" },
              opportunities: [],
              renderBlockingResources: [],
              fetchedAt: pagePs.fetchedAt,
            },
          ]
        : [],
      labNote: pagePs
        ? "From the Google PageSpeed Insights run attached to the latest audit."
        : snapshot.pageSpeed
          ? `The PageSpeed Insights run in the latest audit was for ${snapshot.pageSpeed.url}, not this page. Open the PageSpeed tab to test this page.`
          : "No PageSpeed Insights run is attached to the latest audit.",
      fieldNote: "Chrome UX Report availability is reported per run by Google.",
    },
    search: {
      available: Boolean(row.search),
      rangeStart: snapshot.gsc?.rangeStart ?? null,
      rangeEnd: snapshot.gsc?.rangeEnd ?? null,
      metric: "Clicks and impressions for this page. The per-query breakdown is not collected by the audit.",
      totals: row.search ? { clicks: row.search.clicks, impressions: row.search.impressions, ctr: row.search.ctr, position: row.search.position } : null,
      topQueries: [],
    },
    history: await historyFor(crawl.requestedPath),
    recommendation: null,
  };
}
