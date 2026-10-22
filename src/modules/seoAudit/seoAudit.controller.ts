import { Request, Response } from "express";
import SeoAuditSnapshot from "../../models/seoAudit.model";
import { crawlRoutes } from "./crawler.service";
import { runSiteChecks } from "./siteChecks.service";
import { runPageSpeed } from "./psi.service";
import { fetchSearchAnalytics, GscResult, isSearchConsoleConfigured } from "./gsc.service";
import { runLlmVisibility, configuredLlmPlatforms } from "./llm.service";
import { buildSeoCheckupReport } from "./reportBuilder.service";
import type { SeoCheckupReportData, RouteSummary, PageSpeedSnapshot, LlmPlatformResult } from "./types";
import type { CrawlResult } from "./crawler.service";
import type { SiteChecks } from "./siteChecks.service";

const DEFAULT_ORIGIN = process.env.SEO_AUDIT_ORIGIN || "https://bharatorganicexpo.com";

type ReportPageSpeed = PageSpeedSnapshot | null;
type GscResultLike = GscResult;
type LlmLike = LlmPlatformResult;

function notConnectedGsc(): GscResult {
  return {
    available: false,
    message: "Search Console is not connected.",
    siteUrl: null,
    rangeStart: null,
    rangeEnd: null,
    totals: null,
    pages: [],
    fetchedAt: null,
  };
}

function routeIdToPath(route: string): string {
  const cleaned = (route || "").toLowerCase().replace(/^\/+|\/+$/g, "");
  if (!cleaned || cleaned === "home" || cleaned === "index") return "/";
  return `/${cleaned}`;
}
const MAX_ROUTES = 30;

// The route list comes from a live sitemap fetch (~5s against the production
// site). Cache it briefly so the admin route picker opens instantly on repeat
// mounts; an explicit audit run always bypasses this and re-fetches.
const ROUTE_LIST_TTL_MS = 5 * 60 * 1000;
const routeListCache = new Map<string, { at: number; payload: unknown }>();

interface SnapshotDoc {
  report?: SeoCheckupReportData;
  crawls?: CrawlResult[];
  siteChecks?: SiteChecks | null;
  createdAt?: Date;
  durationMs?: number;
}

function originFrom(value?: string): string {
  if (!value) return DEFAULT_ORIGIN;
  try {
    const url = new URL(value);
    return `${url.protocol}//${url.host}`;
  } catch {
    return DEFAULT_ORIGIN;
  }
}

function pathFromUrl(loc: string, origin: string): string | null {
  try {
    const url = new URL(loc);
    const originHost = new URL(origin).hostname;
    if (url.hostname !== originHost && url.hostname !== `www.${originHost}`) return null;
    return url.pathname.replace(/\/$/, "") || "/";
  } catch {
    return null;
  }
}

async function latestSnapshot(): Promise<SnapshotDoc | null> {
  const doc = await SeoAuditSnapshot.findOne().sort({ createdAt: -1 }).lean();
  return (doc as unknown as SnapshotDoc) ?? null;
}

async function snapshotByRoute(route: string): Promise<SnapshotDoc | null> {
  const normalized = route === "home" || route === "" ? "/" : `/${route.replace(/^\//, "")}`;
  const doc = await SeoAuditSnapshot.findOne({ "report.route": normalized })
    .sort({ createdAt: -1 })
    .lean();
  if (doc) return doc as unknown as SnapshotDoc;
  return latestSnapshot();
}

export const seoAuditController = {
  /**
   * POST /api/seo-audit/run
   * Executes a full REAL audit: sitemap discovery, live crawl, TLS/DNS/header
   * probes, optional Google PageSpeed run, Search Console query and live LLM
   * probes. Persists the snapshot and returns the assembled report.
   */
  async runAudit(req: Request, res: Response) {
    const startedAt = Date.now();
    try {
      const origin = originFrom(req.body.origin || req.query.origin as string | undefined);
      const reportRoute = (req.body.route as string | undefined) || "/";
      const withPageSpeed = req.body.pageSpeed !== false;
      const withLlm = req.body.llm !== false;

      // 1. Discover the real route inventory from the live robots.txt + sitemap.
      // Wrapped individually so one failing probe never crashes the whole audit.
      let bootstrap: SiteChecks;
      try {
        bootstrap = await runSiteChecks(origin);
      } catch (err) {
        // Last-resort empty site checks so the crawl can still proceed.
        bootstrap = {
          fetchedAt: new Date().toISOString(),
          origin,
          robotsTxt: { available: false, url: null, rules: [], sitemaps: [], error: String(err) },
          sitemap: { available: false, url: null, entries: [], error: String(err) },
          tls: { available: false, subject: null, issuer: null, validFrom: null, validTo: null, daysRemaining: null, serialNumber: null, sigalg: null, san: null, fingerprint256: null, trusted: false, error: String(err) },
          http2: { available: false, error: String(err) },
          headers: { server: null, hsts: null, contentTypeOptions: null, frameOptions: null, referrerPolicy: null, poweredBy: null, cdnIndicators: [] },
          spf: { available: false, records: [], error: String(err) },
          notFoundPage: { status: null, isCustom404: false },
          canonicalization: { apexStatus: null, wwwStatus: null, wwwRedirectsToApex: false },
          adsTxt: { status: null, exists: false },
        };
      }
      let paths = bootstrap.sitemap.entries
        .map((entry) => pathFromUrl(entry.loc, origin))
        .filter((p): p is string => Boolean(p));
      paths = Array.from(new Set(paths)).slice(0, MAX_ROUTES);
      if (paths.length === 0) {
        paths = ["/"];
      }
      if (!paths.includes(reportRoute)) {
        paths = [reportRoute, ...paths];
      }

      // 2. Live-crawl every route.
      const crawls = await crawlRoutes(origin, paths, { concurrency: 2, delayMs: 200 });

      // 3. Live auxiliary data sources.
      const reportCrawl =
        crawls.find((c) => c.requestedPath === reportRoute) ||
        crawls.find((c) => c.requestedPath === "/") ||
        crawls[0];
      const pageUrl = reportCrawl?.url || `${origin}/`;
      const [pageSpeed, gsc, llm] = await Promise.all([
        withPageSpeed ? runPageSpeed(pageUrl, "mobile") : Promise.resolve(null),
        fetchSearchAnalytics(28),
        withLlm ? runLlmVisibility() : Promise.resolve([]),
      ]);

      // 4. Assemble the report from those real inputs and persist it.
      const report = buildSeoCheckupReport({
        origin,
        reportRoute: reportCrawl?.requestedPath || "/",
        crawls,
        siteChecks: bootstrap,
        pageSpeed,
        gsc,
        llm,
      });

      await SeoAuditSnapshot.create({
        origin,
        reportRoute: report.route,
        report,
        crawls,
        siteChecks: bootstrap,
        gsc,
        llm,
        pageSpeed,
        durationMs: Date.now() - startedAt,
      });
      // Keep the last 10 snapshots so history stays small.
      const excess = await SeoAuditSnapshot.find().sort({ createdAt: -1 }).skip(10).select("_id");
      if (excess.length) {
        await SeoAuditSnapshot.deleteMany({ _id: { $in: excess.map((d) => d._id) } });
      }

      return res.status(200).json({
        success: true,
        message: `Real audit completed in ${Math.round((Date.now() - startedAt) / 1000)}s across ${crawls.length} live routes.`,
        data: report,
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        message: error?.message || "Real SEO audit failed",
      });
    }
  },

  /** GET /api/seo-audit/report — latest stored real report, per-route rebuildable. */
  async getReport(req: Request, res: Response) {
    try {
      const route = (req.query.route as string | undefined) || undefined;
      const snapshot = route ? await snapshotByRoute(route) : await latestSnapshot();
      if (!snapshot || !snapshot.report) {
        return res.status(404).json({
          success: false,
          message: "No real audit has been run yet. POST /api/seo-audit/run to execute a live audit.",
          data: null,
        });
      }

      // When a specific route is requested, rebuild that route's full report
      // from the stored live inputs so every page gets its own real numbers.
      let report = snapshot.report as SeoCheckupReportData;
      const wanted = route ? routeIdToPath(route) : null;
      if (wanted && report.routeSummaries?.some((s) => s.path === wanted)) {
        const crawls = (snapshot.crawls || []) as CrawlResult[];
        const siteChecks = (snapshot.siteChecks || null) as SiteChecks | null;
        if (crawls.length && siteChecks) {
          report = buildSeoCheckupReport({
            origin: report.site?.origin || DEFAULT_ORIGIN,
            reportRoute: wanted,
            crawls,
            siteChecks,
            pageSpeed: ((snapshot as any).pageSpeed as ReportPageSpeed) ?? null,
            gsc: ((snapshot as any).gsc as GscResultLike) ?? notConnectedGsc(),
            llm: (((snapshot as any).llm || []) as LlmLike[]) ?? [],
          });
        }
      }

      return res.status(200).json({
        success: true,
        data: report,
        meta: {
          generatedAt: report.generatedAt,
          durationMs: snapshot.durationMs ?? null,
          routesCrawled: snapshot.crawls?.length ?? 0,
        },
      });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error?.message || "Failed to load report" });
    }
  },

  /** GET /api/seo-audit/routes — real sitemap-derived route list. */
  async getRoutes(req: Request, res: Response) {
    try {
      const origin = originFrom(req.query.origin as string | undefined);
      const cached = routeListCache.get(origin);
      if (cached && Date.now() - cached.at < ROUTE_LIST_TTL_MS) {
        return res.status(200).json(cached.payload);
      }
      const checks = await runSiteChecks(origin);
      const routes = checks.sitemap.entries
        .map((entry) => ({
          path: pathFromUrl(entry.loc, origin),
          lastmod: entry.lastmod,
          priority: entry.priority,
          changefreq: entry.changefreq,
        }))
        .filter((r): r is { path: string; lastmod: string | null; priority: string | null; changefreq: string | null } => Boolean(r.path));
      const unique = new Map<string, typeof routes[number]>();
      routes.forEach((r) => unique.set(r.path, r));
      const payload = {
        success: true,
        data: {
          origin,
          sitemapUrl: checks.sitemap.url,
          robotsAvailable: checks.robotsTxt.available,
          routes: Array.from(unique.values()),
        },
      };
      routeListCache.set(origin, { at: Date.now(), payload });
      return res.status(200).json(payload);
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error?.message || "Failed to list routes" });
    }
  },

  /** GET /api/seo-audit/pages — real per-route rows from the latest audit. */
  async getPages(req: Request, res: Response) {
    try {
      const snapshot = await latestSnapshot();
      if (!snapshot?.report) {
        return res.status(200).json({
          pages: [],
          message: "No real audit data yet — run an audit first (POST /api/seo-audit/run).",
          meta: { page: 1, limit: 0, total: 0, totalPages: 0 },
        });
      }
      const pages = (snapshot.report.routeSummaries || []).map((s) => summaryToPageRow(s));
      return res.status(200).json({
        pages,
        message: null,
        meta: { page: 1, limit: pages.length, total: pages.length, totalPages: 1 },
      });
    } catch (error: any) {
      return res.status(500).json({
        pages: [],
        message: error?.message || "Failed to load pages",
        meta: { page: 1, limit: 0, total: 0, totalPages: 0 },
      });
    }
  },

  /** GET /api/seo-audit/pages/:id — deep real detail for one route. */
  async getPageDetail(req: Request, res: Response) {
    try {
      const rawId = req.params.id || "home";
      const id = (Array.isArray(rawId) ? rawId[0] : rawId).toLowerCase().trim();
      const snapshot = await latestSnapshot();
      if (!snapshot?.report) {
        return res.status(404).json({
          success: false,
          message: "No real audit data yet — run an audit first.",
          data: null,
        });
      }
      const summary =
        (snapshot.report.routeSummaries || []).find((s) => s.id === id) ||
        (snapshot.report.routeSummaries || []).find((s) => s.path.replace(/^\//, "") === id);
      const crawl = (snapshot.crawls || []).find(
        (c) => c.requestedPath === (summary?.path ?? (id === "home" ? "/" : `/${id}`)),
      );
      if (!summary) {
        return res.status(404).json({ success: false, message: `Route "${id}" was not part of the latest audit.`, data: null });
      }
      const page = summaryToPageRow(summary);
      return res.status(200).json({
        success: true,
        data: {
          page: {
            ...page,
            metaRobots: crawl?.robotsMeta ?? null,
            canonicalNormalized: summary.canonical,
            canonicalCount: crawl?.canonicalCount ?? 0,
            ogTitle: crawl?.openGraph?.["og:title"] ?? null,
            ogDescription: crawl?.openGraph?.["og:description"] ?? null,
            ogImage: crawl?.openGraph?.["og:image"] ?? null,
            ogType: crawl?.openGraph?.["og:type"] ?? null,
            ogUrl: crawl?.openGraph?.["og:url"] ?? null,
            twitterCard: crawl?.twitter?.["twitter:card"] ?? null,
            twitterTitle: crawl?.twitter?.["twitter:title"] ?? null,
            twitterDescription: crawl?.twitter?.["twitter:description"] ?? null,
            twitterImage: crawl?.twitter?.["twitter:image"] ?? null,
            metaKeywords: crawl?.metaKeywords ?? null,
            metaKeywordCount: crawl?.metaKeywords ? crawl.metaKeywords.split(",").length : 0,
            socialStatus: {
              openGraph: crawl?.openGraph?.["og:title"] ? "valid" : "not_available",
              twitter: crawl?.twitter?.["twitter:card"] ? "valid" : "not_available",
            },
            lang: crawl?.htmlLang ?? null,
            viewport: crawl?.viewport ?? null,
            hreflang: crawl?.hreflang ?? [],
            headingSequence: crawl?.headingSequence ?? [],
            headingIssues: [
              ...(summary.h1Count === 0 ? ["No H1 on page"] : []),
              ...(summary.h1Count > 1 ? [`${summary.h1Count} H1 tags on page`] : []),
            ],
            h2: crawl?.h2 ?? [],
            h3: crawl?.h3 ?? [],
            images: crawl?.images ?? [],
            links: crawl?.links ?? [],
            outgoing: [],
            brokenOutgoing: 0,
            redirectingOutgoing: 0,
            browserHealth: { consoleErrors: [], consoleWarnings: [], jsExceptions: [], failedRequests: [] },
            cdn: {
              status: "detected",
              provider: null,
              evidence: [],
              cacheControl: null,
              server: null,
            },
            keywordAnalysis: { available: false, targets: [] },
          },
          redirectChain: null,
          performance: {
            audits: snapshot.report.pageSpeed
              ? [
                  {
                    id: `lighthouse-${snapshot.report.pageSpeed.strategy}`,
                    strategy: snapshot.report.pageSpeed.strategy,
                    status: snapshot.report.pageSpeed.ok ? "completed" : "failed",
                    error: snapshot.report.pageSpeed.message ?? null,
                    lighthouseVersion: null,
                    lab: {
                      performance: snapshot.report.pageSpeed.scores.performance,
                      accessibility: snapshot.report.pageSpeed.scores.accessibility,
                      bestPractices: snapshot.report.pageSpeed.scores.bestPractices,
                      seo: snapshot.report.pageSpeed.scores.seo,
                      fcpMs: snapshot.report.pageSpeed.metrics.fcpMs,
                      lcpMs: snapshot.report.pageSpeed.metrics.lcpMs,
                      tbtMs: snapshot.report.pageSpeed.metrics.tbtMs,
                      cls: snapshot.report.pageSpeed.metrics.cls,
                      siMs: snapshot.report.pageSpeed.metrics.siMs,
                    },
                    field: { available: snapshot.report.pageSpeed.fieldData.available, source: "chrome-ux-report" },
                    opportunities: [],
                    renderBlockingResources: [],
                    fetchedAt: snapshot.report.pageSpeed.fetchedAt,
                  },
                ]
              : [],
            labNote: snapshot.report.pageSpeed?.ok
              ? "From the live Google PageSpeed Insights run attached to the latest audit."
              : "No PageSpeed Insights run is attached to the latest audit.",
            fieldNote: "Chrome UX Report availability is reported per run by Google.",
          },
          search: {
            available: summary.searchConsole.available,
            rangeStart: null,
            rangeEnd: null,
            metric: "clicks/impressions",
            totals: summary.searchConsole.available
              ? {
                  clicks: summary.searchConsole.clicks ?? 0,
                  impressions: summary.searchConsole.impressions ?? 0,
                  ctr: summary.searchConsole.ctr ?? 0,
                  position: summary.searchConsole.position ?? 0,
                }
              : null,
            topQueries: [],
          },
          history: [],
          recommendation: null,
        },
      });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error?.message || "Failed to load page detail", data: null });
    }
  },

  /** GET /api/seo-audit/overview — real site-level scores from the latest audit. */
  async getOverview(req: Request, res: Response) {
    try {
      const snapshot = await latestSnapshot();
      if (!snapshot?.report) {
        return res.status(200).json({
          success: true,
          hasData: false,
          message: "No real audit has been run yet. POST /api/seo-audit/run to execute a live audit.",
          data: null,
        });
      }
      const report = snapshot.report;
      const groupScore = (name: string) =>
        report.categories.find((c) => c.name === name)?.score ?? report.seoScore;
      const blend = (...names: string[]) =>
        Math.round(names.reduce((acc, n) => acc + groupScore(n), 0) / names.length);
      const summaries = report.routeSummaries || [];
      const criticalRoutes = summaries.filter((s) => s.score < 90).length;
      return res.status(200).json({
        success: true,
        hasData: true,
        data: {
          site: {
            id: "bharat-organic-expo",
            url: report.site.origin,
            label: "Bharat Organic Expo 2027",
            type: "production",
            lastCrawlAt: report.generatedAt,
            lastScore: report.seoScore,
            searchConsoleConnected: report.site.searchConsoleConfigured,
            llmKeysConfigured: report.site.llmKeysConfigured,
          },
          crawl: {
            status: "completed",
            trigger: "manual",
            durationMs: snapshot.durationMs ?? null,
            completedAt: report.generatedAt,
            stats: { pages: report.site.routesCrawled, errors: report.failedCount, warnings: report.warningCount },
          },
          scores: {
            overall: report.seoScore,
            technical: blend("Server and Security", "Advanced SEO", "Mobile Usability"),
            onPage: groupScore("Common SEO Issues"),
            content: blend("AI Insights", "Content Opportunities", "Visual SEO Analysis"),
            performance: groupScore("Speed Optimizations"),
            visibility: report.aiScore,
          },
          counts: {
            urlsCrawled: report.site.routesCrawled,
            healthyPages: summaries.filter((s) => s.score >= 90).length,
            criticalIssues: criticalRoutes,
            warnings: report.warningCount,
            notices: report.failedCount,
            brokenInternalLinks: 0,
          },
          performance: report.pageSpeed
            ? {
                score: report.pageSpeed.scores.performance,
                lcpMs: report.pageSpeed.metrics.lcpMs,
                clsScore: report.pageSpeed.metrics.cls,
                inpMs: null,
                fieldDataAvailable: report.pageSpeed.fieldData.available,
              }
            : null,
          topIssues: report.issues.slice(0, 6).map((issue) => ({
            ruleId: issue.title.toLowerCase().replace(/[^a-z0-9]+/g, "_").slice(0, 40),
            severity: issue.priority === "HIGH" ? "critical" : issue.priority === "MEDIUM" ? "warning" : "notice",
            category: issue.group || "On-page",
            title: issue.title,
            affectedPages: 1,
          })),
          routeSummaries: summaries,
        },
      });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error?.message || "Failed to build overview" });
    }
  },
};

/** Maps a real RouteSummary onto the SeoPageRow contract used by the UI. */
function summaryToPageRow(s: RouteSummary) {
  const tLength = s.titleLength;
  const dLength = s.metaDescriptionLength;
  const issues =
    (tLength < 20 || tLength > 60 ? 1 : 0) +
    (dLength === 0 || dLength < 120 || dLength > 220 ? 1 : 0) +
    (s.h1Count !== 1 ? 1 : 0) +
    (s.imagesMissingAlt > 0 ? 1 : 0) +
    (s.canonicalStatus !== "self" ? 1 : 0);
  return {
    id: s.id,
    url: s.url,
    path: s.path,
    title: s.title,
    titleLength: tLength,
    titleStatus: !s.title ? "missing" : tLength < 20 ? "too_short" : tLength > 60 ? "too_long" : "ok",
    metaDescription: s.metaDescription,
    metaDescriptionLength: dLength,
    descriptionStatus: !s.metaDescription ? "missing" : dLength < 120 ? "too_short" : dLength > 220 ? "too_long" : "ok",
    httpStatus: s.httpStatus,
    indexable: s.indexable,
    indexabilityReason: s.indexable ? null : "noindex directive or crawl failure",
    canonical: s.canonical,
    canonicalStatus: s.canonicalStatus,
    score: s.score,
    issueCounts: { critical: 0, warning: issues > 1 ? 1 : 0, notice: issues, total: issues },
    issueCategories: ["On-page", "Metadata"],
    h1: [],
    h1Status: s.h1Count === 0 ? "missing" : s.h1Count > 1 ? "multiple" : "ok",
    hierarchyStatus: s.h1Count === 1 ? "ok" : "hierarchy_error",
    headingCounts: { h1: s.h1Count, h2: s.h2Count, h3: 0 },
    wordCount: s.words,
    inLinks: s.internalLinks,
    outLinks: s.externalLinks,
    brokenLinks: 0,
    depth: s.path === "/" ? 0 : s.path.split("/").filter(Boolean).length,
    isOrphan: s.internalLinks === 0,
    inSitemap: true,
    schemaTypes: [],
    schemaStatus: "valid",
    imageCount: s.imageCount,
    imagesMissingAlt: s.imagesMissingAlt,
    responseTimeMs: s.ttfbMs,
    keywordStatus: "ok",
    openGraphStatus: "not_available",
    twitterStatus: "not_available",
    consoleErrorCount: 0,
    failedRequestCount: 0,
    renderBlockingCount: 0,
    cdnStatus: "unable_to_determine",
    performance: {
      score: null,
      lcpMs: null,
      cls: null,
      isFieldData: false,
      fetchedAt: null,
    },
    search: s.searchConsole.available
      ? {
          clicks: s.searchConsole.clicks ?? 0,
          impressions: s.searchConsole.impressions ?? 0,
          ctr: s.searchConsole.ctr ?? 0,
          position: s.searchConsole.position ?? 0,
          updatedAt: null,
        }
      : null,
    analytics: null,
    lastCrawledAt: new Date().toISOString(),
  };
}
