import { Router, Request, Response } from "express";
import Redirect from "../../models/Redirect.model";
import Seo from "../../models/seo.model";
import AdvancedSeo from "../../models/advancedSeo.model";
import SeoAuditSnapshot from "../../models/seoAudit.model";
import { isSafeRedirectTarget } from "../seoAudit/seoAutoFix.service";
import { toCaddy, toNetlifyRedirects, toNetlifyToml, validRules, type RedirectRule } from "../seoAudit/redirectsExport";
import { imageAltSrc, pageKeyOf } from "../seoAudit/seoPending.service";
import { sitePageKeyForPath, readSitePageSeo } from "../seoAudit/pageSeoStore";
import { internalLinkingService } from "../seoAudit/internalLinking.service";
import { notFoundService, livePagePaths } from "../seoAudit/notFound.service";
import { notFoundReportLimiter, publicSeoReadLimiter } from "../../middlewares/rateLimiter.middleware";
import { notFoundReportSchema, parseOr400 } from "../seoAudit/seoAudit.schemas";
import { SITE_PAGES } from "../sitePages/sitePages.registry";
import type { CrawlResult } from "../seoAudit/crawler.service";
import { deliveryCache } from "./deliveryCache";

/**
 * Public, read-only SEO delivery for the STATICALLY EXPORTED website (Netlify cannot run Next middleware or read
 * the database at request time): the site pulls these at build time (or from an edge function) and bakes them in.
 * Mounted at /api/seo and /api/website/seo BEFORE the seo router's catch-all "/{*page}".
 * Only active, validated data is exposed; everything is cached for 60 seconds.
 */
const router = Router();

const TTL_MS = 60_000;
const MAX_CACHE_ENTRIES = 150;
/** Bounded LRU: a Map keeps insertion order, so the first key is the least recently used */
const cache = deliveryCache;
async function cached<T>(key: string, load: () => Promise<T>): Promise<T> {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) {
    cache.delete(key);
    cache.set(key, hit);
    return hit.value as T;
  }
  const value = await load();
  cache.set(key, { at: Date.now(), value });
  while (cache.size > MAX_CACHE_ENTRIES) cache.delete(cache.keys().next().value as string);
  return value;
}

/** Routes this site really has (crawled live pages + CMS registry), so arbitrary strings never reach the database */
async function isKnownRoute(route: string): Promise<boolean> {
  const known = await cached("known-routes", async () => {
    const set = new Set<string>(["/"]);
    for (const p of await livePagePaths()) set.add(p);
    for (const p of SITE_PAGES) if (p.path) set.add(p.path.replace(/\/+$/, "") || "/");
    return set;
  });
  return known.has(route);
}
const publicCache = (res: Response) => res.setHeader("Cache-Control", "public, max-age=0, s-maxage=10, must-revalidate");

export async function activeRedirectRules(): Promise<RedirectRule[]> {
  const rows = await Redirect.find({ isActive: true }).sort({ createdAt: 1 }).limit(5000).select("fromUrl toUrl statusCode").lean();
  return validRules(
    (rows as any[])
      .filter((r) => isSafeRedirectTarget(String(r.toUrl)))
      .map((r) => ({ from: String(r.fromUrl), to: String(r.toUrl), status: Number(r.statusCode) || 301 }))
  );
}

/** GET /api/seo/redirects[?format=netlify|toml|caddy] */
router.get("/redirects", publicSeoReadLimiter, async (req: Request, res: Response) => {
  try {
    const rules = await cached("redirects", activeRedirectRules);
    publicCache(res);
    if (req.query.format === "netlify") return res.type("text/plain").send(toNetlifyRedirects(rules));
    if (req.query.format === "toml") return res.type("text/plain").send(toNetlifyToml(rules));
    if (req.query.format === "caddy") return res.type("text/plain").send(toCaddy(rules));
    return res.json({ success: true, data: rules, generatedAt: new Date().toISOString() });
  } catch {
    return res.status(500).json({ success: false, message: "Could not load redirects" });
  }
});

const routeParam = (v: unknown): string | null | undefined => {
  if (v === undefined) return undefined;
  if (typeof v !== "string" || v.length > 512 || !/^\/[^\s\u0000-\u001f]*$/.test(v) || v.startsWith("//")) return null;
  return v.replace(/\/+$/, "") || "/";
};

const imageKey = (src: string): string => {
  let s = (src || "").trim();
  try {
    const u = new URL(s, "https://mokshavoyage.in");
    s = u.searchParams.get("url") ? decodeURIComponent(u.searchParams.get("url") as string) : u.pathname;
    s = new URL(s, "https://mokshavoyage.in").pathname;
  } catch {}
  s = s.split("?")[0];
  s = s.replace(/w_\d+/gi, "w_auto");
  s = s.replace(/\.w\d+/gi, "");
  s = s.replace(/\.[a-z0-9]{2,5}$/i, "");
  s = s.replace(/\.[a-z0-9_-]{6,20}$/i, "");
  return s.toLowerCase();
};

/**
 * GET /api/seo/overrides[?route=/about]
 * { h1Heading, imageAlts{src: alt}, internalLinks[{toPath, anchorText}] } for one route, or for every route (build time).
 */
router.get("/overrides", publicSeoReadLimiter, async (req: Request, res: Response) => {
  const route = routeParam(req.query.route);
  if (route === null) return res.status(400).json({ success: false, message: "route must be a path such as /about" });
  if (route && !(await isKnownRoute(route))) return res.status(404).json({ success: false, message: "Unknown route" });
  try {
    const data = await cached(`overrides:${route ?? "*"}`, async () => {
      const siteKey = route ? sitePageKeyForPath(route) : null;
      const [seoDocs, adv, links, snap, siteSeo] = await Promise.all([
        Seo.find(route ? { page: pageKeyOf(route), isActive: { $ne: false } } : { isActive: { $ne: false } }).select("page metaTitle metaDescription h1Heading h1ExtraTag").lean(),
        AdvancedSeo.findOne().select("imageAlts").lean(),
        internalLinkingService.appliedFor(route ?? undefined),
        route ? SeoAuditSnapshot.findOne().sort({ createdAt: -1 }).select("crawls.requestedPath crawls.images").lean() : Promise.resolve(null),
        siteKey ? readSitePageSeo(siteKey) : Promise.resolve(null),
      ]);
      const rawAlts: any = (adv as any)?.imageAlts;
      const all: Record<string, string> = {};
      for (const [k, v] of rawAlts instanceof Map ? rawAlts.entries() : Object.entries(rawAlts || {})) {
        if (typeof v === "string" && v.trim()) all[imageAltSrc(k)] = v;
      }
      const imageAlts = all;
      const h1ByRoute = Object.fromEntries((seoDocs as any[]).filter((d) => d.h1Heading?.trim()).map((d) => [d.page === "home" ? "/" : `/${d.page}`, d.h1Heading.trim()]));
      const h1TagByRoute = Object.fromEntries((seoDocs as any[]).filter((d) => d.h1Heading?.trim()).map((d) => [d.page === "home" ? "/" : `/${d.page}`, d.h1ExtraTag || "h2"]));
      const metaTitlesByRoute = Object.fromEntries((seoDocs as any[]).filter((d) => d.metaTitle?.trim()).map((d) => [d.page === "home" ? "/" : `/${d.page}`, d.metaTitle.trim()]));
      const metaDescriptionsByRoute = Object.fromEntries((seoDocs as any[]).filter((d) => d.metaDescription?.trim()).map((d) => [d.page === "home" ? "/" : `/${d.page}`, d.metaDescription.trim()]));
      const linkRows = (links as any[]).map((l) => ({ fromPath: l.fromPath, toPath: l.toPath, anchorText: l.anchorText }));

      const targetSeo = (seoDocs as any[])[0];
      const metaTitle = siteSeo?.metaTitle?.trim() || targetSeo?.metaTitle?.trim() || null;
      const metaDescription = siteSeo?.metaDescription?.trim() || targetSeo?.metaDescription?.trim() || null;

      return route
        ? {
            route,
            metaTitle,
            metaDescription,
            h1Heading: h1ByRoute[route] ?? null,
            h1ExtraTag: h1TagByRoute[route] ?? "h2",
            imageAlts,
            internalLinks: linkRows.map(({ toPath, anchorText }) => ({ toPath, anchorText })),
          }
        : {
            h1Headings: h1ByRoute,
            h1ExtraTags: h1TagByRoute,
            metaTitles: metaTitlesByRoute,
            metaDescriptions: metaDescriptionsByRoute,
            imageAlts: all,
            internalLinks: linkRows,
          };
    });
    publicCache(res);
    return res.json({ success: true, data });
  } catch {
    return res.status(500).json({ success: false, message: "Could not load overrides" });
  }
});

/** POST /api/seo/404-report { path, referrer? }: rate limited, validated, nothing is trusted. */
router.post("/404-report", notFoundReportLimiter, async (req: Request, res: Response) => {
  const body = parseOr400(notFoundReportSchema, req.body, res);
  if (!body) return;
  try {
    const r = await notFoundService.record(body.path, body.referrer);
    return res.status(r.recorded ? 202 : 200).json({ success: true, recorded: r.recorded });
  } catch {
    return res.status(500).json({ success: false, message: "Could not record the report" });
  }
});

export default router;
