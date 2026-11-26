/**
 * What OUR audit can say about each Semrush check.
 *
 * Only checks our audit really measures are listed (keyed by Semrush's Issue Id). They are read off the crawl and
 * the site checks the last audit run stored, so nothing here fetches anything. A Semrush check that is not listed
 * is reported as "not checked by our audit" instead of being guessed at. A check that is listed but could not be
 * measured on the last run (for example no TLS data) returns null and is reported as "not measured".
 *
 * Our audit crawls the pages in the sitemap (at most 30) and follows no other link, so for page-level checks it
 * sees fewer pages than Semrush does; the comparison says which Semrush URLs our audit did not crawl.
 */

import type { CrawlResult } from "./crawler.service";
import type { SiteChecks } from "./siteChecks.service";
import { THIN_WORDS, TITLE_MAX, TITLE_MIN } from "./pageFindings.service";
import { brokenLinksOf, type LinkStatusMap } from "./linkCheck.service";
import { ALL_CHECKS, buildAuditContext, type AuditContext } from "./siteAudit.checks";

export interface OurContext {
  origin: string;
  crawls: CrawlResult[];
  siteChecks: SiteChecks | null;
  /** Whether each link on the crawled pages works; null when the stored audit never followed links. */
  linkStatuses?: LinkStatusMap | null;
}

export interface OurResult {
  /** How many pages (or, for site-wide checks, how many items) our audit flagged. */
  found: number;
  /** How many pages / items it looked at. */
  total: number;
  /** URLs of the crawled pages it flagged (empty for site-wide checks). */
  urls: string[];
  /** Where our rule differs from Semrush's, shown next to the result. */
  note?: string;
  /** "site" for checks about the whole site (robots.txt, certificate, ...): there is no page to point at. Default "page". */
  scope?: "page" | "site";
}

export type OurCheck = (ctx: OurContext) => OurResult | null;

const bareHost = (host: string) => host.toLowerCase().replace(/^www\./, "");

/** "https://www.site.com/About/?x=1" -> "site.com/About": the same page, whatever the scheme, www, slash or query. */
export function urlKey(url: string): string {
  try {
    const parsed = new URL(url);
    const path = parsed.pathname.replace(/\/+$/, "") || "/";
    return `${bareHost(parsed.hostname)}${path}`;
  } catch {
    return url.trim().toLowerCase();
  }
}

const pathOf = (url: string, base?: string): string | null => {
  try {
    return new URL(url, base).pathname.replace(/\/+$/, "") || "/";
  } catch {
    return null;
  }
};

const okPages = (ctx: OurContext) => ctx.crawls.filter((c) => c.ok);

function pagesWhere(ctx: OurContext, flagged: (c: CrawlResult) => boolean, note?: string): OurResult {
  const pages = okPages(ctx);
  const hits = pages.filter(flagged);
  return { found: hits.length, total: pages.length, urls: hits.map((c) => c.url), note };
}

/** Pages whose value (title, description, ...) is also used by another page. */
function duplicatesOf(ctx: OurContext, value: (c: CrawlResult) => string | null | undefined): OurResult {
  const pages = okPages(ctx);
  const groups = new Map<string, CrawlResult[]>();
  for (const page of pages) {
    const key = (value(page) ?? "").trim().toLowerCase();
    if (!key) continue;
    groups.set(key, [...(groups.get(key) ?? []), page]);
  }
  const hits = Array.from(groups.values()).filter((g) => g.length > 1).flat();
  return { found: hits.length, total: pages.length, urls: hits.map((c) => c.url) };
}

/** Who links to whom among the crawled pages: target path -> number of other crawled pages linking to it. */
function incomingLinkCounts(ctx: OurContext): Map<string, number> {
  const counts = new Map<string, number>();
  const originHost = (() => {
    try {
      return bareHost(new URL(ctx.origin).hostname);
    } catch {
      return "";
    }
  })();
  for (const page of okPages(ctx)) {
    const self = pathOf(page.url);
    const seen = new Set<string>();
    for (const link of page.links ?? []) {
      if (!link.isInternal) continue;
      let target: string | null = null;
      try {
        const parsed = new URL(link.href, page.url);
        if (bareHost(parsed.hostname) === originHost) target = parsed.pathname.replace(/\/+$/, "") || "/";
      } catch {
        target = null;
      }
      if (!target || target === self || seen.has(target)) continue;
      seen.add(target);
      counts.set(target, (counts.get(target) ?? 0) + 1);
    }
  }
  return counts;
}

function sitemapPaths(ctx: OurContext): Set<string> {
  const paths = new Set<string>();
  for (const entry of ctx.siteChecks?.sitemap?.entries ?? []) {
    const p = pathOf(entry.loc);
    if (p) paths.add(p);
  }
  return paths;
}

const TITLE_NOTE = `Titles of ${TITLE_MIN}–${TITLE_MAX} characters pass, the same rule as the uploaded report.`;

export const OUR_CHECKS: Partial<Record<number, OurCheck>> = {
  1: (ctx) => {
    const hits = ctx.crawls.filter((c) => c.httpStatus >= 500);
    return { found: hits.length, total: ctx.crawls.length, urls: hits.map((c) => c.url), note: "Our audit only fetches the pages in the sitemap." };
  },
  2: (ctx) => {
    const hits = ctx.crawls.filter((c) => c.httpStatus >= 400 && c.httpStatus < 500);
    return { found: hits.length, total: ctx.crawls.length, urls: hits.map((c) => c.url), note: "Our audit only fetches the pages in the sitemap." };
  },
  3: (ctx) => pagesWhere(ctx, (c) => !(c.title ?? "").trim()),
  6: (ctx) => duplicatesOf(ctx, (c) => c.title),
  8: (ctx) => {
    const pages = okPages(ctx);
    if (ctx.linkStatuses) {
      const hits = pages.filter((p) => brokenLinksOf(p, ctx.linkStatuses!).internal.length > 0);
      return { found: hits.length, total: pages.length, urls: hits.map((c) => c.url), note: "Our audit followed every link it found on the crawled pages." };
    }
    const byPath = new Map<string, CrawlResult>();
    for (const c of ctx.crawls) {
      const p = pathOf(c.url);
      if (p) byPath.set(p, c);
    }
    const hits = pages.filter((page) =>
      (page.links ?? []).some((link) => {
        if (!link.isInternal) return false;
        const target = pathOf(link.href, page.url);
        const known = target ? byPath.get(target) : undefined;
        return Boolean(known && (!known.ok || known.httpStatus >= 400));
      }),
    );
    return {
      found: hits.length,
      total: pages.length,
      urls: hits.map((c) => c.url),
      note: "This audit was run before links were followed: it can only tell a link is broken when it points at a page it crawled itself. Run a new audit.",
    };
  },
  10: (ctx) => {
    if (!ctx.siteChecks) return null;
    return {
      found: ctx.siteChecks.canonicalization.wwwStatus === null ? 1 : 0,
      total: 1,
      urls: [],
      scope: "site",
      note: "Our audit asks whether the www version of the site answers.",
    };
  },
  12: (ctx) => {
    if (!ctx.linkStatuses) return null;
    const pages = okPages(ctx);
    const hits = pages.filter((p) => brokenLinksOf(p, ctx.linkStatuses!).external.length > 0);
    return { found: hits.length, total: pages.length, urls: hits.map((c) => c.url), note: "Only the first 120 links are checked, our own site's first." };
  },
  15: (ctx) => duplicatesOf(ctx, (c) => c.metaDescription),
  18: (ctx) => {
    const inSitemap = sitemapPaths(ctx);
    const pages = ctx.crawls.filter((c) => {
      const p = pathOf(c.url);
      return p !== null && inSitemap.has(p);
    });
    const hits = pages.filter((c) => !c.ok || c.httpStatus !== 200 || !c.indexable || c.canonicalStatus === "points_elsewhere");
    return { found: hits.length, total: pages.length, urls: hits.map((c) => c.url), note: "A sitemap page that is not live, is noindex, or names another address as its canonical." };
  },
  20: (ctx) => pagesWhere(ctx, (c) => !c.viewport),
  32: (ctx) => {
    const r = ctx.siteChecks?.httpRedirect;
    if (!r || !ctx.origin.startsWith("https://")) return null;
    return { found: r.status === 301 || r.status === 308 ? 0 : 1, total: 1, urls: [], scope: "site" };
  },
  21: (ctx) => pagesWhere(ctx, (c) => c.uncompressedBytes > 2 * 1024 * 1024),
  27: (ctx) => {
    const tls = ctx.siteChecks?.tls;
    if (!tls?.available || tls.daysRemaining === null) return null;
    return { found: tls.daysRemaining < 0 ? 1 : 0, total: 1, urls: [], scope: "site" };
  },
  30: (ctx) => pagesWhere(ctx, (c) => (c.mixedContent ?? []).length > 0),
  39: (ctx) => pagesWhere(ctx, (c) => c.canonicalCount > 1),
  40: (ctx) => pagesWhere(ctx, (c) => c.metaRefresh),
  45: (ctx) => pagesWhere(ctx, (c) => c.jsonLdBlocks > 0 && !c.jsonLdValid),
  46: (ctx) => pagesWhere(ctx, (c) => !c.viewport),
  101: (ctx) => pagesWhere(ctx, (c) => (c.title ?? "").trim().length > 0 && (c.title ?? "").trim().length < TITLE_MIN, TITLE_NOTE),
  102: (ctx) => pagesWhere(ctx, (c) => (c.title ?? "").trim().length > TITLE_MAX, TITLE_NOTE),
  103: (ctx) => pagesWhere(ctx, (c) => c.h1.length === 0),
  104: (ctx) => pagesWhere(ctx, (c) => c.h1.length > 1),
  105: (ctx) =>
    pagesWhere(ctx, (c) => {
      const title = (c.title ?? "").trim().toLowerCase();
      return Boolean(title) && c.h1.some((h) => h.trim().toLowerCase() === title);
    }),
  106: (ctx) => pagesWhere(ctx, (c) => !(c.metaDescription ?? "").trim()),
  110: (ctx) => pagesWhere(ctx, (c) => (c.imagesMissingAlt ?? []).length > 0),
  112: (ctx) => {
    const measured = okPages(ctx).filter((c) => typeof c.textRatio === "number");
    if (measured.length === 0) return null;
    const hits = measured.filter((c) => (c.textRatio as number) < 10);
    return { found: hits.length, total: measured.length, urls: hits.map((c) => c.url), note: "Visible text under 10% of the HTML, the same rule as the uploaded report." };
  },
  114: (ctx) => pagesWhere(ctx, (c) => !c.htmlLang, "Our audit checks the lang attribute on <html>."),
  115: (ctx) => pagesWhere(ctx, (c) => !c.charset),
  117: (ctx) => pagesWhere(ctx, (c) => c.wordCount < THIN_WORDS, `Pages under ${THIN_WORDS} words count as thin, the same rule as the uploaded report.`),
  121: (ctx) => pagesWhere(ctx, (c) => (c.deprecatedTags ?? []).some((t) => t === "frame" || t === "frameset")),
  122: (ctx) => pagesWhere(ctx, (c) => (pathOf(c.url) ?? "").includes("_")),
  123: (ctx) => pagesWhere(ctx, (c) => (c.links ?? []).some((l) => l.isInternal && l.isNofollow)),
  124: (ctx) => {
    const robots = ctx.siteChecks?.robotsTxt;
    if (!robots?.available) return null;
    return { found: robots.sitemaps.length === 0 ? 1 : 0, total: 1, urls: [], scope: "site" };
  },
  125: (ctx) => {
    if (!ctx.siteChecks) return null;
    return { found: ctx.siteChecks.sitemap.available ? 0 : 1, total: 1, urls: [], scope: "site" };
  },
  126: (ctx) => ({ found: ctx.origin.startsWith("http://") ? 1 : 0, total: 1, urls: [], scope: "site" }),
  128: (ctx) => {
    const sitemap = ctx.siteChecks?.sitemap;
    if (!sitemap?.available || !ctx.origin.startsWith("https://")) return null;
    return { found: sitemap.entries.filter((e) => e.loc.startsWith("http://")).length, total: sitemap.entries.length, urls: [], scope: "site" };
  },
  203: (ctx) => {
    if (!ctx.siteChecks) return null;
    return { found: ctx.siteChecks.robotsTxt.available ? 0 : 1, total: 1, urls: [], scope: "site" };
  },
  205: (ctx) => {
    if (!ctx.siteChecks || !ctx.origin.startsWith("https://")) return null;
    return { found: ctx.siteChecks.headers.hsts ? 0 : 1, total: 1, urls: [], scope: "site" };
  },
  206: (ctx) => {
    const incoming = incomingLinkCounts(ctx);
    const pages = okPages(ctx).filter((c) => {
      const p = pathOf(c.url);
      return p !== null && p !== "/";
    });
    const hits = pages.filter((c) => {
      const p = pathOf(c.url);
      return p !== null && p !== "/" && (incoming.get(p) ?? 0) === 0;
    });
    return {
      found: hits.length,
      total: pages.length,
      urls: hits.map((c) => c.url),
      note: "Evaluated from internal crawl link graph (GA integration pending).",
    };
  },
  207: (ctx) => {
    const inSitemap = sitemapPaths(ctx);
    const incoming = incomingLinkCounts(ctx);
    const pages = okPages(ctx).filter((c) => {
      const p = pathOf(c.url);
      return p !== null && inSitemap.has(p);
    });
    const hits = pages.filter((c) => {
      const p = pathOf(c.url);
      return p !== null && p !== "/" && (incoming.get(p) ?? 0) === 0;
    });
    return {
      found: hits.length,
      total: pages.length,
      urls: hits.map((c) => c.url),
      note: "Counted only from the links between the pages our audit crawled.",
    };
  },
  213: (ctx) => {
    const incoming = incomingLinkCounts(ctx);
    return pagesWhere(
      ctx,
      (c) => {
        const p = pathOf(c.url);
        return p !== null && p !== "/" && incoming.get(p) === 1;
      },
      "Counted only from the links between the pages our audit crawled.",
    );
  },
};

const clip = (value: string, max = 110): string => (value.length > max ? `${value.slice(0, max)}…` : value);

/**
 * What our own crawl actually saw on a page, for the checks it can read off the page (title, headings, text...).
 * Shown next to a Semrush finding so the numbers can be checked against the live page. Empty when the crawl has
 * nothing to say about this check.
 */
export function evidenceFor(checkId: number, c: CrawlResult, audit?: AuditContext): string[] {
  const title = (c.title ?? "").trim();
  const desc = (c.metaDescription ?? "").trim();
  switch (checkId) {
    case 3:
    case 6:
    case 101:
    case 102:
      return [title ? `Title: "${clip(title)}" (${title.length} characters)` : "No title found"];
    case 15:
    case 106:
      return [desc ? `Description: "${clip(desc)}" (${desc.length} characters)` : "No meta description found"];
    case 103:
    case 104:
    case 105:
      return [c.h1.length ? `${c.h1.length} H1 tag(s): ${c.h1.slice(0, 3).map((h) => `"${clip(h.trim(), 60)}"`).join(", ")}` : "No H1 found"];
    case 110: {
      const missing = c.imagesMissingAlt ?? [];
      return [missing.length ? `${missing.length} image(s) without alt text, e.g. ${missing.slice(0, 2).map((s) => clip(String(s), 60)).join(", ")}` : "All images have alt text"];
    }
    case 8:
    case 12: {
      if (!audit?.links) return [];
      const broken = brokenLinksOf(c, audit.links);
      const list = checkId === 8 ? broken.internal : broken.external;
      return list.slice(0, 4).map((l) => `${l.href} → ${l.status}`);
    }
    case 117:
      return [`${c.wordCount} words on the page`];
    case 112:
      return typeof c.textRatio === "number" ? [`Visible text is ${c.textRatio}% of the HTML (${c.wordCount} words)`] : [];
    case 20:
    case 46:
      return [c.viewport ? `Viewport tag: ${clip(c.viewport, 60)}` : "No viewport tag"];
    case 114:
      return [c.htmlLang ? `<html lang="${c.htmlLang}">` : "No lang attribute on <html>"];
    case 115:
      return [c.charset ? `Charset: ${c.charset}` : "No charset declared"];
    case 1:
    case 2:
      return [`Our crawl got HTTP ${c.httpStatus || "no response"}`];
    case 21:
      return [`HTML size: ${Math.round(c.uncompressedBytes / 1024)} KB`];
    case 30:
      return (c.mixedContent ?? []).length ? [`Insecure resources: ${(c.mixedContent ?? []).slice(0, 2).map((s) => clip(s, 60)).join(", ")}`] : ["No insecure resources found"];
    case 45:
      return c.jsonLdBlocks > 0 ? [c.jsonLdValid ? `${c.jsonLdBlocks} structured-data block(s), all valid` : `Structured data error: ${clip(c.jsonLdError ?? "invalid JSON-LD", 100)}`] : ["No structured data on the page"];
    default: {
      // The wider site-audit checks explain themselves: what was measured on this page, and the examples.
      const def = ALL_CHECKS.find((d) => d.id === checkId && d.scope === "page");
      const verdict = def && audit ? def.measure(c, audit) : null;
      return verdict ? [verdict.summary, ...(verdict.evidence ?? []).slice(0, 3)] : [];
    }
  }
}


/* ----------------------------------------------------------------------------------------- */
/* The wider site-audit checks: one definition serves both the audit report and this comparison */
/* ----------------------------------------------------------------------------------------- */

const auditContexts = new WeakMap<OurContext, AuditContext>();
const auditContextOf = (ctx: OurContext): AuditContext => {
  let built = auditContexts.get(ctx);
  if (!built) {
    built = buildAuditContext({ origin: ctx.origin, crawls: ctx.crawls, siteChecks: ctx.siteChecks, linkStatuses: ctx.linkStatuses });
    auditContexts.set(ctx, built);
  }
  return built;
};

for (const def of ALL_CHECKS) {
  OUR_CHECKS[def.id] =
    def.scope === "site"
      ? (ctx) => {
          const verdict = def.measure(null, auditContextOf(ctx));
          return verdict ? { found: verdict.flagged ? 1 : 0, total: 1, urls: [], scope: "site", note: verdict.flagged ? verdict.summary : undefined } : null;
        }
      : (ctx) => {
          const audit = auditContextOf(ctx);
          const hits: string[] = [];
          let total = 0;
          for (const crawl of ctx.crawls) {
            const verdict = def.measure(crawl, audit);
            if (!verdict) continue;
            total += 1;
            if (verdict.flagged) hits.push(crawl.url);
          }
          return total === 0 ? null : { found: hits.length, total, urls: hits };
        };
}
