import { URL } from "url";
import { CrawlResult } from "./crawler.service";
import Seo from "../../models/seo.model";
import { SitePage } from "../../models/sitePages/SitePage.model";
import { sitePageRoutes, isSitePageField, readSitePageSeo } from "./pageSeoStore";

export function pageKeyOf(path: string): string {
  const k = (path || "/").toLowerCase().replace(/^\/+|\/+$/g, "");
  return !k || k === "home" || k === "index" ? "home" : k;
}

/**
 * Extracts a clean canonical URL from either a raw URL string or a full <link rel="canonical" href="..." /> tag.
 */
export function extractCanonicalUrl(rawUrl?: string | null, rawTag?: string | null): string | null {
  if (rawUrl && typeof rawUrl === "string" && rawUrl.trim()) {
    const val = rawUrl.trim();
    const m = val.match(/href\s*=\s*["']([^"']+)["']/i);
    if (m && m[1]) return m[1].trim();
    // In case someone pasted an entire HTML tag or extra brackets
    const cleaned = val.replace(/<[^>]*>/g, "").trim();
    if (cleaned) return cleaned;
  }
  if (rawTag && typeof rawTag === "string" && rawTag.trim()) {
    const val = rawTag.trim();
    const m = val.match(/href\s*=\s*["']([^"']+)["']/i);
    if (m && m[1]) return m[1].trim();
    const cleaned = val.replace(/<[^>]*>/g, "").trim();
    if (cleaned) return cleaned;
  }
  return null;
}

export interface CanonicalValidationResult {
  ok: boolean;
  status: "missing" | "valid_self" | "invalid_url" | "insecure_http" | "wrong_domain" | "points_elsewhere";
  title: string;
  detail: string;
  expectedUrl: string;
  actualUrl: string | null;
}

/**
 * Validates whether a candidate canonical URL is valid, accessible, and self-referencing for the given route.
 */
export function validateCanonical(
  candidate: string | null | undefined,
  route: string,
  siteOrigin: string,
): CanonicalValidationResult {
  const cleanRoute = (route || "/").split(/[?#]/)[0].replace(/\/+$/, "") || "/";
  const cleanOrigin = siteOrigin.replace(/\/+$/, "");
  const expectedUrl = `${cleanOrigin}${cleanRoute === "/" ? "" : cleanRoute}`;

  if (!candidate || !candidate.trim()) {
    return {
      ok: false,
      status: "missing",
      title: "Missing canonical link",
      detail: "Add a self-referencing canonical URL.",
      expectedUrl,
      actualUrl: null,
    };
  }

  const raw = candidate.trim();
  if (!/^https?:\/\//i.test(raw)) {
    return {
      ok: false,
      status: "invalid_url",
      title: "Relative or invalid canonical URL",
      detail: `The canonical URL "${raw}" is not an absolute URL. Canonical URLs must start with https://.`,
      expectedUrl,
      actualUrl: raw,
    };
  }

  let candUrl: URL;
  try {
    candUrl = new URL(raw);
  } catch {
    return {
      ok: false,
      status: "invalid_url",
      title: "Invalid canonical URL",
      detail: `The canonical URL "${raw}" is malformed or not a valid URL.`,
      expectedUrl,
      actualUrl: raw,
    };
  }

  if (candUrl.protocol !== "http:" && candUrl.protocol !== "https:") {
    return {
      ok: false,
      status: "invalid_url",
      title: "Invalid canonical protocol",
      detail: `The canonical URL "${raw}" uses an invalid protocol (${candUrl.protocol}). Use https://.`,
      expectedUrl,
      actualUrl: raw,
    };
  }

  const originUrl = new URL(siteOrigin);
  // Check protocol: if site origin is https, canonical must use https
  if (originUrl.protocol === "https:" && candUrl.protocol === "http:") {
    return {
      ok: false,
      status: "insecure_http",
      title: "Insecure HTTP canonical URL",
      detail: `The canonical URL uses insecure http:// ("${raw}"). Use https:// to prevent search index confusion.`,
      expectedUrl,
      actualUrl: raw,
    };
  }

  // Check domain (without "www.")
  const candHost = candUrl.hostname.toLowerCase().replace(/^www\./, "");
  const originHost = originUrl.hostname.toLowerCase().replace(/^www\./, "");
  if (candHost !== originHost) {
    return {
      ok: false,
      status: "wrong_domain",
      title: "Canonical points to a different domain",
      detail: `The canonical URL points to external domain "${candUrl.hostname}" (${raw}) instead of "${originUrl.hostname}". Google may attribute page ranking to the external domain.`,
      expectedUrl,
      actualUrl: raw,
    };
  }

  // Check path
  const candPath = (candUrl.pathname || "/").replace(/\/+$/, "") || "/";
  if (candPath.toLowerCase() !== cleanRoute.toLowerCase()) {
    return {
      ok: false,
      status: "points_elsewhere",
      title: "Canonical points to a different page",
      detail: `The canonical link points to "${raw}" (path ${candPath}), but this page's route is "${cleanRoute}". Search engines may index the other page instead of this one.`,
      expectedUrl,
      actualUrl: raw,
    };
  }

  // Check query parameters or hash
  if (candUrl.search || candUrl.hash) {
    return {
      ok: false,
      status: "points_elsewhere",
      title: "Canonical contains query parameters or hash",
      detail: `The canonical URL contains query parameters or hash (${raw}). Canonical URLs should be clean URLs without query parameters.`,
      expectedUrl,
      actualUrl: raw,
    };
  }

  return {
    ok: true,
    status: "valid_self",
    title: "Canonical tag valid",
    detail: `A valid self-referencing canonical tag (${expectedUrl}) is set.`,
    expectedUrl,
    actualUrl: raw,
  };
}

/**
 * Overlays admin-saved database SEO fields (from SitePage, home2, and Seo collections)
 * onto in-memory crawl results, ensuring real-time parity before reports are generated.
 */
export async function overlayDatabaseSeoOnCrawls(crawls: CrawlResult[], origin: string): Promise<CrawlResult[]> {
  try {
    const [seoDocs, sitePages] = await Promise.all([
      Seo.find({}).select("page metaTitle metaDescription canonicalUrl canonicalTag ogTitle ogDescription ogImage schemaMarkup h1Heading robotsIndex robotsFollow").lean(),
      SitePage.find({}).select("key seo.metaTitle seo.metaDescription seo.canonicalUrl seo.canonicalTag seo.ogTitle seo.ogDescription seo.ogImage seo.schemaMarkup seo.robotsIndex seo.robotsFollow seo.twitterCard seo.twitterTitle seo.twitterDescription seo.twitterImage").lean(),
    ]);

    const seoByKey = new Map<string, any>((seoDocs as any[]).map((d) => [String(d.page), d]));
    const seoOfKey = new Map<string, any>((sitePages as any[]).map((d) => [String(d.key), d.seo || {}]));
    try {
      seoOfKey.set("home2", await readSitePageSeo("home2"));
    } catch {
      /* ignore home2 load error */
    }

    for (const [route, key] of sitePageRoutes()) {
      const own = seoOfKey.get(key);
      if (!own) continue;
      const pk = pageKeyOf(route);
      const merged: Record<string, any> = { ...(seoByKey.get(pk) || {}) };
      for (const [k, v] of Object.entries(own)) {
        if (isSitePageField(k)) merged[k] = v;
      }
      seoByKey.set(pk, merged);
    }

    for (const c of crawls) {
      const route = c.requestedPath || "/";
      const pk = pageKeyOf(route);
      const db = seoByKey.get(pk);
      if (!db) continue;

      if (typeof db.metaTitle === "string") {
        const t = db.metaTitle.trim();
        c.title = t || null;
        c.titleLength = t.length;
      }
      if (typeof db.metaDescription === "string") {
        const d = db.metaDescription.trim();
        c.metaDescription = d || null;
        c.descriptionLength = d.length;
      }
      if (typeof db.h1Heading === "string") {
        const h = db.h1Heading.trim();
        c.h1 = h ? [h] : [];
      }
      if (db.robotsIndex !== undefined || db.robotsFollow !== undefined) {
        c.indexable = db.robotsIndex !== false;
        c.nofollowMeta = db.robotsFollow === false;
        c.robotsMeta = `${db.robotsIndex === false ? "noindex" : "index"}, ${db.robotsFollow === false ? "nofollow" : "follow"}`;
      }
      const dbCanonical = extractCanonicalUrl(db.canonicalUrl, db.canonicalTag);
      if (dbCanonical) {
        c.canonical = dbCanonical;
        c.canonicalCount = 1;
        const v = validateCanonical(dbCanonical, route, origin);
        c.canonicalStatus = v.ok ? "self" : "points_elsewhere";
      } else if (c.canonical) {
        const v = validateCanonical(c.canonical, route, origin);
        c.canonicalStatus = v.ok ? "self" : "points_elsewhere";
      }

      if (typeof db.ogTitle === "string" || typeof db.ogDescription === "string" || typeof db.ogImage === "string") {
        c.openGraph = {
          ...(c.openGraph || {}),
          ...(typeof db.ogTitle === "string" ? { "og:title": db.ogTitle.trim() } : {}),
          ...(typeof db.ogDescription === "string" ? { "og:description": db.ogDescription.trim() } : {}),
          ...(typeof db.ogImage === "string" ? { "og:image": db.ogImage.trim() } : {}),
        };
      }
      if (typeof db.twitterCard === "string" || typeof db.twitterTitle === "string" || typeof db.twitterDescription === "string" || typeof db.twitterImage === "string") {
        c.twitter = {
          ...(c.twitter || {}),
          ...(typeof db.twitterCard === "string" ? { "twitter:card": db.twitterCard.trim() } : {}),
          ...(typeof db.twitterTitle === "string" ? { "twitter:title": db.twitterTitle.trim() } : {}),
          ...(typeof db.twitterDescription === "string" ? { "twitter:description": db.twitterDescription.trim() } : {}),
          ...(typeof db.twitterImage === "string" ? { "twitter:image": db.twitterImage.trim() } : {}),
        };
      }
      if (typeof db.schemaMarkup === "string") {
        const raw = db.schemaMarkup.trim();
        if (!raw) {
          c.jsonLdBlocks = 0;
          c.jsonLdValid = false;
          c.jsonLdTypes = [];
        } else {
          try {
            const cleaned = raw.replace(/<script[^>]*>/gi, "").replace(/<\/script>/gi, "").trim();
            const parsed = JSON.parse(cleaned);
            const target = Array.isArray(parsed) ? parsed[0] : parsed;
            const t = target?.["@type"];
            c.jsonLdBlocks = Math.max(1, c.jsonLdBlocks || 0);
            c.jsonLdValid = true;
            c.jsonLdTypes = t ? (Array.isArray(t) ? t : [String(t)]) : [];
          } catch (e: any) {
            c.jsonLdBlocks = Math.max(1, c.jsonLdBlocks || 0);
            c.jsonLdValid = false;
            c.jsonLdError = e.message;
            c.jsonLdTypes = [];
          }
        }
      }
    }
  } catch (err: any) {
    // If database overlay fails, crawl results remain as-is
  }
  return crawls;
}
