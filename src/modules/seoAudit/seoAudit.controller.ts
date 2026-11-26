import { Request, Response } from "express";
import { Admin } from "../../models/Admin.model";

async function resolveAdminName(req: Request): Promise<string> {
  const u = (req as any).user;
  if (u?.name) return u.name;
  if (u?.id) {
    const admin = await Admin.findById(u.id).select("name email").lean().catch(() => null);
    if (admin?.name) return admin.name;
    if (admin?.email) return admin.email;
  }
  return u?.email || "Admin User";
}
import SeoAuditSnapshot from "../../models/seoAudit.model";
import { crawlRoutes } from "./crawler.service";
import { checkLinks, linkStatusesFromList, linkStatusesToList } from "./linkCheck.service";
import { checkExternalRobots } from "./siteChecks.service";
import { runSiteChecks } from "./siteChecks.service";
import { runPageSpeed } from "./psi.service";
import { fetchSearchAnalytics, GscResult, isSearchConsoleConfigured } from "./gsc.service";
import { runLlmVisibility, configuredLlmPlatforms } from "./llm.service";
import { buildSeoCheckupReport } from "./reportBuilder.service";
import type { SeoCheckupReportData, RouteSummary, PageSpeedSnapshot, LlmPlatformResult } from "./types";
import type { CrawlResult } from "./crawler.service";
import type { SiteChecks } from "./siteChecks.service";
import { buildPageDetail, buildPageRows, type AuditSnapshot } from "./pageRows.service";
import { getSiteHost, getSiteId, getSiteName, getSiteOrigin, isAuditedOrigin, toOrigin } from "../../config/seoSite";
import { seoAutoFixService, isSafeRedirectTarget, StaleRollbackError } from "./seoAutoFix.service";
import { autoFixSchema, rollbackSchema, redirectSchema, contentAnalyzeSchema, humanizeSchema, scheduleSchema, parseOr400, pageParam } from "./seoAudit.schemas";
import { seoExcelExportService } from "./seoExcelExport.service";
import { seoAiContentService } from "./seoAiContent.service";
import { seoAuditQueueService, acquireAuditLock, releaseAuditLock, forceUnlockAudit } from "./seoAuditQueue.service";
import Redirect from "../../models/Redirect.model";
import SeoFixLog from "../../models/seoFixLog.model";


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
const MAX_ROUTES = 60;
/**
 * Internal page addresses linked from the crawled pages that are not already in the list (query and #hash dropped;
 * addresses that end in a file extension such as .pdf or .jpg are files, not pages).
 */
export function discoverLinkedPaths(origin: string, crawls: CrawlResult[], known: Set<string>): string[] {
  const bare = (h: string) => h.toLowerCase().replace(/^www\./, "");
  let host = "";
  try {
    host = bare(new URL(origin).hostname);
  } catch {
    return [];
  }
  const found = new Set<string>();
  for (const crawl of crawls) {
    for (const link of crawl.links ?? []) {
      if (!link.isInternal) continue;
      try {
        const u = new URL(link.href, crawl.url);
        if (bare(u.hostname) !== host) continue;
        const path = u.pathname.replace(/\/+$/, "") || "/";
        if (/\.[a-z0-9]{2,5}$/i.test(path) || known.has(path)) continue;
        found.add(path);
      } catch {
        /* not a usable address */
      }
    }
  }
  return Array.from(found);
}


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

/**
 * The site to audit. A caller may name it, but only if it is the configured site (with or without
 * "www"): otherwise anyone who can reach this endpoint could make the server fetch any address.
 * Returns null, after sending a 400, when a different site was asked for.
 */
function resolveOrigin(value: unknown, res: Response): string | null {
  if (typeof value !== "string" || !value.trim()) return getSiteOrigin();
  const origin = toOrigin(value);
  if (origin && isAuditedOrigin(origin)) return origin;
  res.status(400).json({
    success: false,
    message: `Only ${getSiteOrigin()} can be audited. Change SEO_AUDIT_ORIGIN to audit another site.`,
  });
  return null;
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

// One audit at a time (Redis lock across processes + in-process flag): see seoAuditQueue.service

/** Which report check an admin fix of each kind settles (the report only sees it after the next audit) */
const TESTS_OF_FIX: Record<string, string[]> = {
  // only the check a fix settles by itself; a check that can still fail for another reason is not claimed
  title: ["meta-title"],
  description: ["meta-description"],
  og: ["social-meta"],
  h1: ["heading-tags"],
  image_alt: ["image-alt"],
  schema: ["structured-data"],
  canonical: ["canonical"],
};

/**
 * The report is built from the audit's crawl, so a fix made after the audit is not in it yet. Every issue that a later,
 * still-applied fix addresses is marked, so the report can say "fixed, confirmed by the next audit" instead of showing
 * a problem that was already dealt with as if nobody had touched it.
 */
async function markFixedAfterAudit(report: SeoCheckupReportData, auditedAt: Date | string | undefined): Promise<void> {
  if (!auditedAt || !report.issues?.length) return;
  const logs: any[] = await SeoFixLog.find({ status: "applied", reverted: false, createdAt: { $gt: new Date(auditedAt) } })
    .select("route issueType createdAt fixedBy")
    .lean();
  if (!logs.length) return;
  for (const issue of report.issues) {
    if (!issue.testId) continue;
    const hit = logs.find((l) => (l.route || "/") === (issue.route || "/") && (TESTS_OF_FIX[l.issueType] ?? []).includes(issue.testId as string));
    if (hit) issue.fixedAfterAudit = { at: new Date(hit.createdAt).toISOString(), by: hit.fixedBy };
  }
}

export const seoAuditController = {
  async unlockAudit(_req: Request, res: Response) {
    try {
      await forceUnlockAudit();
      return res.status(200).json({ success: true, message: "Audit lock cleared successfully." });
    } catch (err: any) {
      return res.status(500).json({ success: false, message: err?.message || "Failed to clear lock" });
    }
  },

  /**
   * POST /api/seo-audit/run
   * Executes a full REAL audit: sitemap discovery, live crawl, TLS/DNS/header
   * probes, optional Google PageSpeed run, Search Console query and live LLM
   * probes. Persists the snapshot and returns the assembled report.
   */
  async runAudit(req: Request, res: Response) {
    const force = Boolean(req.body?.force);
    const lockToken = await acquireAuditLock(force);
    if (!lockToken) {
      return res.status(409).json({ success: false, message: "An audit is already running. Wait for it to finish, then run again." });
    }
    const startedAt = Date.now();
    try {
      const origin = resolveOrigin(req.body?.origin ?? req.query.origin, res);
      if (!origin) return;
      const requestedRoute = typeof req.body?.route === "string" ? req.body.route.trim() : "";
      // A route is a path on the site ("/about"), never a URL.
      const reportRoute = /^\/(?!\/)/.test(requestedRoute) ? requestedRoute : "/";
      const withPageSpeed = req.body?.pageSpeed !== false;
      const withLlm = req.body?.llm !== false;

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
      let crawls = await crawlRoutes(origin, paths, { concurrency: 2, delayMs: 200 });

      // 2a. Pages that exist but are missing from the sitemap are found through the links of the pages just crawled.
      const discovered = discoverLinkedPaths(origin, crawls, new Set(paths)).slice(0, Math.max(0, MAX_ROUTES - paths.length));
      if (discovered.length > 0) {
        crawls = [...crawls, ...(await crawlRoutes(origin, discovered, { concurrency: 2, delayMs: 200 }))];
      }

      // The audit records what the live pages really serve. What the admin saved but the website does not show yet is not
      // mixed in here: the Issues list shows it separately as "saved, waiting for website".

      // 2b. Follow every link found on those pages and see whether it still works.
      const linkStatuses = await checkLinks(crawls).catch(() => null);

      // 2c. robots.txt of other sites that serve files to these pages.
      const ownHost = new URL(origin).hostname.replace(/^www\./, "");
      const externalHosts = new Set<string>();
      for (const c of crawls) {
        for (const u of [...(c.stylesheets ?? []), ...(c.scripts ?? []), ...(c.images ?? []).map((i) => i.src ?? "")]) {
          try {
            const h = new URL(u, c.url).hostname;
            if (/^https?:/.test(new URL(u, c.url).protocol) && h.replace(/^www\./, "") !== ownHost) externalHosts.add(h);
          } catch { /* not a usable address */ }
        }
      }
      bootstrap.externalRobots = await checkExternalRobots(Array.from(externalHosts)).catch(() => undefined);

      // 3. Live auxiliary data sources.
      const reportCrawl =
        crawls.find((c) => c.requestedPath === reportRoute) ||
        crawls.find((c) => c.requestedPath === "/") ||
        crawls[0];
      const pageUrl = reportCrawl?.url || `${origin}/`;
      const [pageSpeedMobile, pageSpeedDesktop, gsc, llm] = await Promise.all([
        withPageSpeed ? runPageSpeed(pageUrl, "mobile") : Promise.resolve(null),
        withPageSpeed ? runPageSpeed(pageUrl, "desktop") : Promise.resolve(null),
        fetchSearchAnalytics(28),
        withLlm ? runLlmVisibility() : Promise.resolve([]),
      ]);

      // 4. Assemble the report from those real inputs and persist it.
      const report = buildSeoCheckupReport({
        origin,
        reportRoute: reportCrawl?.requestedPath || "/",
        crawls,
        siteChecks: bootstrap,
        pageSpeed: pageSpeedMobile,
        pageSpeedDesktop,
        gsc,
        llm,
        linkStatuses,
      });

      await SeoAuditSnapshot.create({
        origin,
        reportRoute: report.route,
        report,
        crawls,
        siteChecks: bootstrap,
        linkChecks: linkStatusesToList(linkStatuses),
        gsc,
        llm,
        pageSpeed: pageSpeedMobile,
        pageSpeedDesktop,
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
    } finally {
      await releaseAuditLock(lockToken);
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
        let crawls = (snapshot.crawls || []) as CrawlResult[];
        const siteChecks = (snapshot.siteChecks || null) as SiteChecks | null;
        if (crawls.length && siteChecks) {
          const origin = report.site?.origin || getSiteOrigin();
          const targetUrl = wanted === "/" ? `${origin}/` : `${origin}${wanted}`;
          const pageSpeedMobile = ((snapshot as any).pageSpeed as ReportPageSpeed) ?? null;
          const pageSpeedDesktop = ((snapshot as any).pageSpeedDesktop as ReportPageSpeed) ?? null;

          report = buildSeoCheckupReport({
            origin,
            reportRoute: wanted,
            crawls,
            siteChecks,
            pageSpeed: pageSpeedMobile,
            pageSpeedDesktop,
            gsc: ((snapshot as any).gsc as GscResultLike) ?? notConnectedGsc(),
            llm: (((snapshot as any).llm || []) as LlmLike[]) ?? [],
            linkStatuses: linkStatusesFromList((snapshot as any).linkChecks),
          });
        }
      } else {
        if (!report.pageSpeedDesktop) {
          report.pageSpeedDesktop = ((snapshot as any).pageSpeedDesktop as ReportPageSpeed) ?? null;
        }
        if (!report.pageSpeed) {
          report.pageSpeed = ((snapshot as any).pageSpeed as ReportPageSpeed) ?? null;
        }
      }

      await markFixedAfterAudit(report, (snapshot as any).createdAt);

      return res.status(200).json({
        success: true,
        data: report,
        meta: {
          generatedAt: report.generatedAt,
          durationMs: snapshot.durationMs ?? null,
          routesCrawled: snapshot.crawls?.length ?? 0,
          auditedAt: (snapshot as any).createdAt ?? null,
        },
      });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error?.message || "Failed to load report" });
    }
  },

  /** GET /api/seo-audit/routes — real sitemap-derived route list. */
  async getRoutes(req: Request, res: Response) {
    try {
      const origin = resolveOrigin(req.query.origin, res);
      if (!origin) return;
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

  /** GET /api/seo-audit/pages — one row per crawled route, read off the latest audit's crawl. */
  async getPages(_req: Request, res: Response) {
    try {
      const snapshot = await latestSnapshot();
      if (!snapshot?.report) {
        return res.status(200).json({
          pages: [],
          message: "No real audit data yet — run an audit first (POST /api/seo-audit/run).",
          meta: { page: 1, limit: 0, total: 0, totalPages: 0 },
        });
      }
      const pages = buildPageRows(snapshot as unknown as AuditSnapshot);
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

  /** GET /api/seo-audit/pages/:id — the full detail of one route. */
  async getPageDetail(req: Request, res: Response) {
    try {
      const rawId = req.params.id || "home";
      const id = (Array.isArray(rawId) ? rawId[0] : rawId).toLowerCase().trim();
      const snapshot = await latestSnapshot();
      if (!snapshot?.report) {
        return res.status(404).json({ success: false, message: "No real audit data yet — run an audit first.", data: null });
      }
      const detail = await buildPageDetail(snapshot as unknown as AuditSnapshot, id);
      if (!detail) {
        return res.status(404).json({ success: false, message: `Route "${id}" was not part of the latest audit.`, data: null });
      }
      return res.status(200).json({ success: true, data: detail });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error?.message || "Failed to load page detail", data: null });
    }
  },

  /**
   * GET /api/seo-audit/pagespeed?url=&strategy=mobile|desktop&refresh=1
   * A live Google PageSpeed Insights (Lighthouse) run for one page of the audited site, cached for
   * 6 hours. Only pages of the configured site are accepted: this spends the PageSpeed quota.
   */
  async getPageSpeed(req: Request, res: Response) {
    const url = String(req.query.url ?? "");
    if (!/^https?:\/\//i.test(url) || !isAuditedOrigin(url)) {
      return res.status(400).json({ success: false, message: `Enter a valid URL on ${getSiteHost()}` });
    }
    const strategy = req.query.strategy === "desktop" ? "desktop" : "mobile";
    const snapshot = await runPageSpeed(url, strategy, req.query.refresh === "1");
    // 200 even when Google could not be reached: `ok` and `message` in the result say what happened.
    return res.status(200).json({ success: true, data: snapshot });
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
            id: getSiteId(),
            url: report.site.origin,
            label: getSiteName(),
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

  /** POST /api/seo-audit/auto-fix — 1-click self-healing for single issue or full page */
  async autoFix(req: Request, res: Response) {
    const body = parseOr400(autoFixSchema, req.body, res);
    if (!body) return;
    try {
      const user = await resolveAdminName(req);
      const result = await seoAutoFixService.autoFixPage(body.pageUrl, body.route, body.issueType, body.options, user, { dryRun: body.dryRun });
      return res.status(200).json(result);
    } catch (err: any) {
      const inputError = /required|invalid|must|cannot|too long/i.test(err?.message || "");
      return res.status(inputError ? 400 : 500).json({ success: false, message: err.message || "Failed to auto-fix issue" });
    }
  },

  /** POST /api/seo-audit/rollback — roll back a previously applied auto-fix */
  async rollbackFix(req: Request, res: Response) {
    const body = parseOr400(rollbackSchema, req.body, res);
    if (!body) return;
    try {
      const user = await resolveAdminName(req);
      const result = await seoAutoFixService.rollbackFix(body.fixLogId, user, body.force);
      return res.status(200).json(result);
    } catch (err: any) {
      const status = err instanceof StaleRollbackError ? 409 : err?.status === 404 || /not found|no longer exists/i.test(err?.message || "") ? 404 : /already|only an applied/i.test(err?.message || "") ? 409 : 500;
      return res.status(status).json({ success: false, stale: err instanceof StaleRollbackError, message: err.message || "Failed to rollback fix" });
    }
  },

  /** GET /api/seo-audit/fix-logs — list auto-fix audit logs with pagination */
  async getFixLogs(req: Request, res: Response) {
    try {
      const page = pageParam(req, "page");
      const limit = pageParam(req, "limit", 30);
      const route = typeof req.query.route === "string" ? req.query.route : undefined;
      const issueType = typeof req.query.issueType === "string" ? req.query.issueType : undefined;
      const reverted = req.query.reverted !== undefined ? req.query.reverted === "true" : undefined;
      const result = await seoAutoFixService.getFixLogs({ page, limit, route, issueType, reverted });
      return res.status(200).json({ success: true, data: result });
    } catch (err: any) {
      return res.status(500).json({ success: false, message: err.message || "Failed to fetch fix logs" });
    }
  },

  /** GET /api/seo-audit/export-excel — multi-tab enterprise Excel (.xlsx) export */
  async exportExcel(req: Request, res: Response) {
    try {
      const buffer = await seoExcelExportService.generateAuditExcel();
      const fileName = `${getSiteId()}-seo-audit-${new Date().toISOString().split("T")[0]}.xlsx`;
      res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader("Content-Length", buffer.length);
      return res.send(buffer);
    } catch (err: any) {
      return res.status(500).json({ success: false, message: err.message || "Failed to export Excel report" });
    }
  },

  /** POST /api/seo-audit/content-analyze-live — live crawl & AI content / EEAT scan */
  async contentAnalyzeLive(req: Request, res: Response) {
    try {
      const body = parseOr400(contentAnalyzeSchema, req.body, res);
      if (!body) return;
      const target = body.url || body.route || "/";
      const result = await seoAiContentService.scanPageLive(target);
      return res.status(200).json({ success: true, data: result });
    } catch (err: any) {
      return res.status(500).json({ success: false, message: err.message || "Failed to analyze live content" });
    }
  },

  /** GET /api/seo-audit/site-content-scan — site-wide AI content & image authenticity matrix */
  async siteContentScan(req: Request, res: Response) {
    try {
      const result = await seoAiContentService.scanEntireSiteLive();
      return res.status(200).json({ success: true, data: result });
    } catch (err: any) {
      return res.status(500).json({ success: false, message: err.message || "Failed to scan site content" });
    }
  },

  /** POST /api/seo-audit/humanize-content — 1-click AI copy humanization with optional DB save */
  async humanizeContent(req: Request, res: Response) {
    try {
      const body = parseOr400(humanizeSchema, req.body, res);
      if (!body) return;
      const { text, instructions, targetKeyword, route, saveToDb } = body;
      const user = await resolveAdminName(req);
      const result = await seoAiContentService.humanizeContent({
        text,
        instructions,
        targetKeyword,
        route,
        saveToDb,
        user,
      });
      return res.status(200).json({ success: true, data: result });
    } catch (err: any) {
      return res.status(500).json({ success: false, message: err.message || "Failed to humanize content" });
    }
  },

  /** POST /api/seo-audit/redirect — create or update a 301 redirect */
  async addRedirect(req: Request, res: Response) {
    const body = parseOr400(redirectSchema, req.body, res);
    if (!body) return;
    try {
      const user = await resolveAdminName(req);
      // same code path as the 1-click fix: validates the target, normalises the source, writes the audit log
      const result = await seoAutoFixService.autoFixPage(body.fromUrl, body.fromUrl, "redirect", { fromUrl: body.fromUrl, toUrl: body.toUrl, statusCode: body.statusCode }, user);
      const redirect = await Redirect.findOne({ fromUrl: result.fixLog?.newValue?.fromUrl }).lean();
      return res.status(200).json({ success: true, data: redirect, fixLog: result.fixLog });
    } catch (err: any) {
      const inputError = /required|invalid|must|cannot|too long|blocked/i.test(err?.message || "");
      return res.status(inputError ? 400 : 500).json({ success: false, message: err.message || "Failed to create redirect" });
    }
  },

  /** GET /api/seo-audit/redirects — list all redirects */
  async getRedirects(req: Request, res: Response) {
    try {
      const redirects = await Redirect.find().sort({ createdAt: -1 }).lean();
      return res.status(200).json({ success: true, data: redirects });
    } catch (err: any) {
      return res.status(500).json({ success: false, message: err.message || "Failed to get redirects" });
    }
  },

  /** GET /api/seo-audit/schedule — get audit queue status and schedule */
  async getSchedule(req: Request, res: Response) {
    try {
      const status = await seoAuditQueueService.getQueueStatus();
      return res.status(200).json({ success: true, data: status });
    } catch (err: any) {
      return res.status(500).json({ success: false, message: err.message || "Failed to get audit schedule" });
    }
  },

  /** POST /api/seo-audit/schedule — update audit schedule & auto-pilot settings */
  async updateSchedule(req: Request, res: Response) {
    try {
      const body = parseOr400(scheduleSchema, req.body, res);
      if (!body) return;
      const schedule = await seoAuditQueueService.updateSchedule(body);
      return res.status(200).json({ success: true, data: schedule });
    } catch (err: any) {
      const input = err?.status === 400 || /URL|non-public|resolved|credentials|http/i.test(err?.message || "");
      return res.status(input ? 400 : 500).json({ success: false, message: err.message || "Failed to update audit schedule" });
    }
  },
};
