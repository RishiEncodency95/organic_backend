/**
 * The site-audit checks beyond the basic on-page ones: crawlability, links and redirects, content and HTML, resources,
 * security protocols, hreflang and AMP.
 *
 * Every check is a pure function of what the audit measured (the crawl of each page, the site probes, the status of
 * every link / image / script / stylesheet). One definition serves two readers: the audit report (one route at a time)
 * and the comparison with an uploaded report (every page). A check whose data was not measured by the stored audit
 * returns null, so it is never shown as "passed" without evidence.
 */

import { signatureSimilarity, type CrawlResult } from "./crawler.service";
import type { SiteChecks } from "./siteChecks.service";
import { isBrokenLink, type LinkStatusMap } from "./linkCheck.service";
import { THIN_WORDS } from "./pageFindings.service";
import type { CheckupTest } from "./types";

export type CheckGroupKey = "crawlability" | "links" | "content" | "resources" | "security" | "international";

export const CHECK_GROUPS: Record<CheckGroupKey, { name: string; note: string }> = {
  crawlability: { name: "Crawlability & Indexing", note: "Can search engines open, read and tell apart every page" },
  links: { name: "Links & Redirects", note: "Where the links of this page lead, and how redirects behave" },
  content: { name: "Content & HTML", note: "Headings, text, markup and URL hygiene read from the live HTML" },
  resources: { name: "Resources & Performance", note: "Scripts, stylesheets and page weight fetched during this audit" },
  security: { name: "Security & Protocols", note: "TLS, certificate and crawl-file checks probed live" },
  international: { name: "International & AMP", note: "hreflang and AMP markup read from the live HTML" },
};

export interface AuditContext {
  origin: string;
  /** Host without "www". */
  host: string;
  crawls: CrawlResult[];
  siteChecks: SiteChecks | null;
  links: LinkStatusMap | null;
  /** Number of other crawled pages linking to each path. */
  incoming: Map<string, number>;
  /** Clicks from the home page to each crawled path. */
  depth: Map<string, number>;
  /** Sitemap <lastmod> by path. */
  lastmod: Map<string, string>;
}

export interface Verdict {
  flagged: boolean;
  level: "failed" | "warning";
  summary: string;
  evidence?: string[];
  fix?: string;
}

export interface CheckDef {
  /** The id of the matching check in the uploaded site-audit report. */
  id: number;
  name: string;
  group: CheckGroupKey;
  scope: "page" | "site";
  measure: (crawl: CrawlResult | null, ctx: AuditContext) => Verdict | null;
}

const bare = (host: string) => host.toLowerCase().replace(/^www\./, "");
const cleanPath = (p: string) => p.replace(/\/+$/, "") || "/";

function pathOf(url: string, base?: string): string | null {
  try {
    return cleanPath(new URL(url, base).pathname);
  } catch {
    return null;
  }
}

const stripHash = (url: string): string => {
  try {
    const u = new URL(url);
    u.hash = "";
    return u.toString();
  } catch {
    return url;
  }
};

export function buildAuditContext(input: {
  origin: string;
  crawls: CrawlResult[];
  siteChecks: SiteChecks | null;
  linkStatuses?: LinkStatusMap | null;
}): AuditContext {
  const { origin, crawls, siteChecks } = input;
  let host = "";
  try {
    host = bare(new URL(origin).hostname);
  } catch {
    host = "";
  }

  const incoming = new Map<string, number>();
  const graph = new Map<string, Set<string>>();
  for (const page of crawls) {
    if (!page.ok) continue;
    const self = pathOf(page.url) ?? "/";
    const targets = new Set<string>();
    for (const link of page.links ?? []) {
      if (!link.isInternal) continue;
      const target = pathOf(link.href, page.url);
      if (target && target !== self) targets.add(target);
    }
    graph.set(self, targets);
    for (const t of targets) incoming.set(t, (incoming.get(t) ?? 0) + 1);
  }

  const depth = new Map<string, number>([["/", 0]]);
  const queue = ["/"];
  while (queue.length > 0) {
    const current = queue.shift() as string;
    for (const next of graph.get(current) ?? []) {
      if (!depth.has(next)) {
        depth.set(next, (depth.get(current) ?? 0) + 1);
        queue.push(next);
      }
    }
  }

  const lastmod = new Map<string, string>();
  for (const entry of siteChecks?.sitemap?.entries ?? []) {
    const p = pathOf(entry.loc);
    if (p && entry.lastmod) lastmod.set(p, entry.lastmod);
  }
  return { origin, host, crawls, siteChecks, links: input.linkStatuses ?? null, incoming, depth, lastmod };
}

/* ----------------------------------------------------------------------------------------- */
/* Small helpers                                                                              */
/* ----------------------------------------------------------------------------------------- */

const pass = (summary: string): Verdict => ({ flagged: false, level: "warning", summary });
const fail = (summary: string, fix: string, evidence?: string[]): Verdict => ({ flagged: true, level: "failed", summary, fix, evidence });
const warn = (summary: string, fix: string, evidence?: string[]): Verdict => ({ flagged: true, level: "warning", summary, fix, evidence });
const list = (items: string[], max = 6) => items.slice(0, max);
const short = (s: string, n = 90) => (s.length > n ? `${s.slice(0, n)}…` : s);

/** A crawl made by a version of the audit that predates the newer measurements. */
const isOldCrawl = (c: CrawlResult) => c.hasDoctype === undefined;

const isOwn = (ctx: AuditContext, url: string, base: string): boolean => {
  try {
    return bare(new URL(url, base).hostname) === ctx.host;
  } catch {
    return false;
  }
};

const absolute = (url: string, base: string): string | null => {
  try {
    return stripHash(new URL(url, base).toString());
  } catch {
    return null;
  }
};

/** Do these robots.txt rules block `path` for everyone (user-agent *) or for Googlebot? */
export function rulesBlock(rules: Array<{ userAgent: string; allow: string[]; disallow: string[] }>, path: string): boolean {
  const groups = rules.filter((r) => r.userAgent === "*" || /googlebot/i.test(r.userAgent));
  const matches = (rule: string) => {
    if (!rule) return false;
    const anchored = rule.endsWith("$");
    const body = (anchored ? rule.slice(0, -1) : rule).replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*");
    return new RegExp(`^${body}${anchored ? "$" : ""}`).test(path);
  };
  let longestAllow = -1;
  let longestDisallow = -1;
  for (const g of groups) {
    for (const a of g.allow) if (matches(a)) longestAllow = Math.max(longestAllow, a.length);
    for (const d of g.disallow) if (matches(d)) longestDisallow = Math.max(longestDisallow, d.length);
  }
  return longestDisallow > longestAllow && longestDisallow >= 0;
}

/** Does this site's robots.txt block `path`? */
export function robotsBlocks(siteChecks: SiteChecks | null, path: string): boolean {
  if (!siteChecks?.robotsTxt?.available) return false;
  return rulesBlock(siteChecks.robotsTxt.rules, path);
}

const status = (ctx: AuditContext, url: string) => ctx.links?.[stripHash(url)];

const HREFLANG = /^(x-default|[a-z]{2,3}(-[a-z]{4})?(-([a-z]{2}|\d{3}))?)$/i;
const BOT_BLOCKING_HOSTS = /(^|\.)(linkedin|facebook|instagram|twitter|x|youtube|pinterest|whatsapp|t)\.(com|me)$/i;
const safeHost = (url: string): string => {
  try {
    return new URL(url).hostname;
  } catch {
    return "";
  }
};
const VAGUE_ANCHORS = new Set(["click here", "here", "read more", "more", "learn more", "link", "this", "click", "details", "view more", "know more"]);
const FILE_EXT = /\.(jpe?g|png|gif|webp|svg|avif|css|js)(\?.*)?$/i;

/** A page's scripts and stylesheets with what the audit learned about each. */
function resourcesOf(c: CrawlResult, ctx: AuditContext) {
  const urls = Array.from(new Set([...(c.stylesheets ?? []), ...(c.scripts ?? [])].map(stripHash)));
  return urls.map((url) => ({ url, own: isOwn(ctx, url, c.url), info: status(ctx, url) }));
}

/* ----------------------------------------------------------------------------------------- */
/* Page checks                                                                                */
/* ----------------------------------------------------------------------------------------- */

const PAGE_DEFS: Array<Omit<CheckDef, "scope">> = [
  {
    id: 1, name: "5xx Server Errors Test", group: "crawlability",
    measure: (c) => (c!.httpStatus >= 500 ? fail(`This page answered with a server error (HTTP ${c!.httpStatus}).`, "Find why the server fails on this page and fix it, or remove the page from the sitemap.") : pass(`HTTP ${c!.httpStatus || "no response"}: no server error.`)),
  },
  {
    id: 2, name: "4xx Errors Test", group: "crawlability",
    measure: (c) => (c!.httpStatus >= 400 && c!.httpStatus < 500 ? fail(`This page answered HTTP ${c!.httpStatus}.`, "Remove the links that point here, redirect it to a working page, or stop publishing it.") : pass(`HTTP ${c!.httpStatus || "no response"}: not a 4xx error.`)),
  },
  {
    id: 3, name: "Title Tag Presence Test", group: "content",
    measure: (c) => (c!.ok ? ((c!.title ?? "").trim() ? pass(`A title is set: "${short(c!.title ?? "", 70)}".`) : fail("The page has no title tag, or it is empty.", "Add a unique <title> to this page.")) : null),
  },
  {
    id: 4, name: "Blocked by robots.txt Test", group: "crawlability",
    measure: (c, ctx) => {
      if (!ctx.siteChecks?.robotsTxt?.available) return null;
      const path = pathOf(c!.url) ?? "/";
      return robotsBlocks(ctx.siteChecks, path)
        ? warn(`robots.txt blocks search engines from ${path}.`, "Remove the Disallow rule if this page should be in Google.")
        : pass("robots.txt does not block this page.");
    },
  },
  {
    id: 6, name: "Duplicate Title Test", group: "content",
    measure: (c, ctx) => {
      const title = (c!.title ?? "").trim().toLowerCase();
      if (!c!.ok || !title) return null;
      const twins = ctx.crawls.filter((o) => o !== c && o.ok && (o.title ?? "").trim().toLowerCase() === title).map((o) => o.url);
      return twins.length > 0 ? fail(`${twins.length} other page(s) use exactly this title.`, "Give every page its own title.", list(twins)) : pass("No other audited page has this title.");
    },
  },
  {
    id: 7, name: "Duplicate Content Test", group: "content",
    measure: (c, ctx) => {
      if (!c!.ok || !c!.contentSignature?.length) return c!.ok && c!.contentSignature ? pass("Too little text to compare with other pages.") : null;
      const twins = ctx.crawls.filter((o) => o !== c && o.ok && signatureSimilarity(c!.contentSignature, o.contentSignature) >= 0.85);
      return twins.length > 0
        ? fail(`${twins.length} other page(s) carry almost the same text (85% or more).`, "Rewrite or merge the pages, or point the copies to the main page with a canonical tag.", list(twins.map((o) => o.url)))
        : pass("No other audited page has near-identical text.");
    },
  },
  {
    id: 9, name: "Page Crawl Test", group: "crawlability",
    // A page that answered with an HTTP error is reported by the 4xx / 5xx checks; this one is for pages that could not be read at all.
    measure: (c) => (c!.ok || c!.httpStatus >= 400 ? pass("The page was crawled.") : fail(`The audit could not crawl this page${c!.httpStatus ? ` (HTTP ${c!.httpStatus})` : ""}${c!.error ? `: ${c!.error}` : ""}.`, "Check the page loads quickly and is not blocked by the server or firewall.")),
  },
  {
    id: 11, name: "Page Opens Test", group: "crawlability",
    measure: (c) => (!c!.ok && !c!.httpStatus ? fail(`The page could not be opened${c!.error ? `: ${c!.error}` : ""}.`, "Check the server, firewall and SSL for this address.") : pass("The page opened.")),
  },
  {
    id: 13, name: "Broken Internal Images Test", group: "links",
    measure: (c, ctx) => {
      if (!ctx.links || !c!.ok) return null;
      const broken = (c!.images ?? []).map((i) => (i.src ? absolute(i.src, c!.url) : null)).filter((u): u is string => Boolean(u) && isOwn(ctx, u as string, c!.url) && isBrokenLink(status(ctx, u as string)));
      return broken.length > 0 ? fail(`${broken.length} image(s) hosted on this site do not load.`, "Fix the image addresses or remove the images.", list(broken.map((u) => `${u} → ${status(ctx, u)?.status ?? status(ctx, u)?.error}`))) : pass("Every checked image on this site loads.");
    },
  },
  {
    id: 14, name: "Broken External Images Test", group: "links",
    measure: (c, ctx) => {
      if (!ctx.links || !c!.ok) return null;
      const broken = (c!.images ?? []).map((i) => (i.src ? absolute(i.src, c!.url) : null)).filter((u): u is string => Boolean(u) && !isOwn(ctx, u as string, c!.url) && isBrokenLink(status(ctx, u as string)));
      return broken.length > 0 ? warn(`${broken.length} image(s) hosted elsewhere do not load.`, "Replace or remove them.", list(broken.map((u) => `${u} → ${status(ctx, u)?.status ?? status(ctx, u)?.error}`))) : pass("Every checked image hosted elsewhere loads.");
    },
  },
  {
    id: 15, name: "Duplicate Meta Description Test", group: "content",
    measure: (c, ctx) => {
      const d = (c!.metaDescription ?? "").trim().toLowerCase();
      if (!c!.ok || !d) return null;
      const twins = ctx.crawls.filter((o) => o !== c && o.ok && (o.metaDescription ?? "").trim().toLowerCase() === d).map((o) => o.url);
      return twins.length > 0 ? fail(`${twins.length} other page(s) use exactly this meta description.`, "Give every page its own meta description.", list(twins)) : pass("No other audited page has this description.");
    },
  },
  {
    id: 21, name: "HTML Page Size Test", group: "resources",
    measure: (c) => (c!.ok ? (c!.uncompressedBytes > 2 * 1024 * 1024 ? fail(`The HTML is ${(c!.uncompressedBytes / 1048576).toFixed(1)} MB (over 2 MB).`, "Reduce the HTML size: remove inline data and unused markup.") : pass(`The HTML is ${Math.round(c!.uncompressedBytes / 1024)} KB (under 2 MB).`)) : null),
  },
  {
    id: 23, name: "hreflang Values Test", group: "international",
    measure: (c) => {
      if (!c!.ok) return null;
      const tags = c!.hreflang ?? [];
      if (tags.length === 0) return pass("No hreflang tags are used on this page.");
      const bad = tags.filter((t) => !HREFLANG.test(t.hreflang.trim()));
      return bad.length > 0 ? fail(`${bad.length} hreflang value(s) are not valid language/region codes.`, "Use codes such as en, en-GB or x-default.", list(bad.map((t) => t.hreflang))) : pass(`All ${tags.length} hreflang values are valid.`);
    },
  },
  {
    id: 24, name: "hreflang Conflicts Test", group: "international",
    measure: (c) => {
      if (!c!.ok) return null;
      const tags = c!.hreflang ?? [];
      if (tags.length === 0) return pass("No hreflang tags are used on this page.");
      const byLang = new Map<string, Set<string>>();
      for (const t of tags) byLang.set(t.hreflang.toLowerCase(), (byLang.get(t.hreflang.toLowerCase()) ?? new Set()).add(t.href));
      const conflicts = Array.from(byLang).filter(([, hrefs]) => hrefs.size > 1).map(([l]) => l);
      const selfRef = tags.some((t) => (absolute(t.href, c!.url) ?? "").replace(/\/$/, "") === c!.url.replace(/\/$/, ""));
      if (conflicts.length > 0) return fail(`The same language points to different pages: ${conflicts.join(", ")}.`, "Keep one address per language.");
      return selfRef ? pass("hreflang tags are consistent and include this page.") : fail("hreflang tags do not include this page itself.", "Add a self-referencing hreflang tag.");
    },
  },
  {
    id: 25, name: "hreflang Links Test", group: "international",
    measure: (c, ctx) => {
      if (!c!.ok) return null;
      const tags = c!.hreflang ?? [];
      if (tags.length === 0) return pass("No hreflang tags are used on this page.");
      if (!ctx.links) return null;
      const bad = tags.map((t) => absolute(t.href, c!.url)).filter((u): u is string => Boolean(u) && isBrokenLink(status(ctx, u as string)));
      return bad.length > 0 ? fail(`${bad.length} hreflang link(s) lead to a missing page.`, "Fix the hreflang addresses.", list(bad)) : pass("All hreflang links work.");
    },
  },
  {
    id: 204, name: "hreflang Language Match Test", group: "international",
    measure: (c) => {
      if (!c!.ok) return null;
      const self = (c!.hreflang ?? []).find((t) => (absolute(t.href, c!.url) ?? "").replace(/\/$/, "") === c!.url.replace(/\/$/, ""));
      if (!self || !c!.htmlLang) return pass("No hreflang to compare with the page language.");
      const same = self.hreflang.toLowerCase().split("-")[0] === c!.htmlLang.toLowerCase().split("-")[0] || self.hreflang === "x-default";
      return same ? pass("The page's hreflang matches its lang attribute.") : warn(`hreflang says "${self.hreflang}" but <html lang> is "${c!.htmlLang}".`, "Make hreflang and the lang attribute agree.");
    },
  },
  {
    id: 26, name: "Secure Page Test", group: "security",
    measure: (c, ctx) => {
      if (!c!.ok || !ctx.origin.startsWith("https://")) return null;
      return c!.finalUrl.startsWith("http://") ? fail("This page is served over http, not https.", "Serve it over https and redirect http to https.") : pass("This page is served over https.");
    },
  },
  {
    id: 31, name: "Links to HTTP Pages Test", group: "links",
    measure: (c, ctx) => {
      if (!c!.ok || !ctx.origin.startsWith("https://")) return null;
      const bad = (c!.links ?? []).filter((l) => l.isInternal && l.href.startsWith("http://")).map((l) => l.href);
      return bad.length > 0 ? warn(`${bad.length} link(s) point to http:// pages of this https site.`, "Change internal links to https://.", list(Array.from(new Set(bad)))) : pass("No internal link points to an http:// page.");
    },
  },
  {
    id: 33, name: "Redirect Chains and Loops Test", group: "links",
    measure: (c, ctx) => {
      if (!c!.ok || isOldCrawl(c!)) return null;
      const own = c!.redirects ?? [];
      const chained = (c!.links ?? [])
        .filter((l) => l.isInternal)
        .map((l) => ({ href: stripHash(l.href), s: status(ctx, l.href) }))
        .filter((x) => (x.s?.redirects?.length ?? 0) >= 2);
      const bad = own.length >= 3 || chained.length > 0;
      return bad
        ? fail(`${own.length >= 3 ? `This page was reached through ${own.length} redirects. ` : ""}${chained.length > 0 ? `${chained.length} internal link(s) go through two or more redirects.` : ""}`.trim(), "Link straight to the final address and remove redirect chains.", list(chained.map((x) => x.href)))
        : pass("No redirect chains or loops.");
    },
  },
  {
    id: 109, name: "Temporary Redirects Test", group: "links",
    measure: (c, ctx) => {
      if (!c!.ok || isOldCrawl(c!)) return null;
      const temp = (c!.links ?? []).filter((l) => l.isInternal && (status(ctx, l.href)?.redirects ?? []).some((s) => [302, 303, 307].includes(s))).map((l) => stripHash(l.href));
      const own = (c!.redirects ?? []).some((r) => [302, 303, 307].includes(r.status));
      return temp.length > 0 || own ? warn(`${own ? "This page is reached through a temporary redirect. " : ""}${temp.length > 0 ? `${temp.length} internal link(s) go through a temporary redirect.` : ""}`.trim(), "Use a permanent (301) redirect where the move is permanent.", list(Array.from(new Set(temp)))) : pass("No temporary redirects.");
    },
  },
  {
    id: 214, name: "Permanent Redirects Test", group: "links",
    measure: (c, ctx) => {
      if (!c!.ok || isOldCrawl(c!)) return null;
      const perm = (c!.links ?? []).filter((l) => l.isInternal && (status(ctx, l.href)?.redirects ?? []).some((s) => s === 301 || s === 308)).map((l) => stripHash(l.href));
      return perm.length > 0 ? warn(`${perm.length} internal link(s) point at an address that redirects permanently.`, "Link directly to the final address.", list(Array.from(new Set(perm)))) : pass("No internal link points at a redirecting address.");
    },
  },
  {
    id: 38, name: "Canonical URL Works Test", group: "crawlability",
    measure: (c, ctx) => {
      if (!c!.ok) return null;
      if (!c!.canonical) return pass("No canonical address is set.");
      const target = absolute(c!.canonical, c!.url);
      if (!ctx.links || !target) return null;
      const s = status(ctx, target);
      if (!s) return null;
      return isBrokenLink(s) ? fail(`The canonical address does not load (${s.status ?? s.error}).`, "Make the canonical tag point to a page that loads.", [target]) : pass("The canonical address loads.");
    },
  },
  {
    id: 39, name: "Multiple Canonical Tags Test", group: "crawlability",
    measure: (c) => (c!.ok ? (c!.canonicalCount > 1 ? fail(`${c!.canonicalCount} canonical tags are set on this page.`, "Keep exactly one canonical tag.") : pass(`${c!.canonicalCount} canonical tag(s) on the page.`)) : null),
  },
  {
    id: 40, name: "Meta Refresh Redirect Test", group: "crawlability",
    measure: (c) => (c!.ok ? (c!.metaRefresh ? fail("The page forwards visitors with a meta refresh.", "Replace it with a proper 301 redirect.") : pass("No meta refresh redirect.")) : null),
  },
  {
    id: 41, name: "Broken Internal JS and CSS Test", group: "resources",
    measure: (c, ctx) => {
      if (!c!.ok || !ctx.links) return null;
      const broken = resourcesOf(c!, ctx).filter((r) => r.own && isBrokenLink(r.info));
      return broken.length > 0 ? fail(`${broken.length} script/stylesheet file(s) of this site do not load.`, "Fix or remove the files that return an error.", list(broken.map((r) => `${r.url} → ${r.info?.status ?? r.info?.error}`))) : pass("Every script and stylesheet of this site loads.");
    },
  },
  {
    id: 211, name: "Broken External JS and CSS Test", group: "resources",
    measure: (c, ctx) => {
      if (!c!.ok || !ctx.links) return null;
      const broken = resourcesOf(c!, ctx).filter((r) => !r.own && isBrokenLink(r.info));
      return broken.length > 0 ? warn(`${broken.length} script/stylesheet file(s) hosted elsewhere do not load.`, "Fix or remove them.", list(broken.map((r) => `${r.url} → ${r.info?.status ?? r.info?.error}`))) : pass("Every script and stylesheet hosted elsewhere loads.");
    },
  },
  {
    id: 44, name: "Malformed Links Test", group: "links",
    measure: (c) => {
      if (!c!.ok || !c!.malformedLinks) return null;
      return c!.malformedLinks.length > 0 ? fail(`${c!.malformedLinks.length} link(s) are not valid web addresses.`, "Correct the href values in the templates and content.", list(c!.malformedLinks)) : pass("Every link is a valid address.");
    },
  },
  {
    id: 46, name: "Viewport Width Test", group: "content",
    measure: (c) => {
      if (!c!.ok) return null;
      if (!c!.viewport) return fail("No viewport tag, so the width is not set for phones.", "Add <meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">.");
      return /width\s*=\s*device-width/i.test(c!.viewport) ? pass("The viewport width is set to device-width.") : fail(`The viewport tag does not set width=device-width ("${short(c!.viewport, 60)}").`, "Set width=device-width.");
    },
  },
  {
    id: 105, name: "H1 and Title Differ Test", group: "content",
    measure: (c) => {
      const title = (c!.title ?? "").trim().toLowerCase();
      if (!c!.ok || !title || c!.h1.length === 0) return null;
      return c!.h1.some((h) => h.trim().toLowerCase() === title) ? warn("The H1 is exactly the same as the page title.", "Write an H1 that differs from the title.") : pass("The H1 differs from the title.");
    },
  },
  {
    id: 108, name: "Links per Page Test", group: "links",
    measure: (c) => (c!.ok ? ((c!.links ?? []).length > 3000 ? warn(`${c!.links.length} links on this page (over 3000).`, "Cut down the number of links.") : pass(`${(c!.links ?? []).length} links on this page (3000 or fewer).`)) : null),
  },
  {
    id: 111, name: "Page Load Time Test", group: "resources",
    measure: (c) => (c!.ok ? (c!.totalMs > 3000 ? fail(`The page took ${(c!.totalMs / 1000).toFixed(1)}s to download (over 3s).`, "Speed up the page: compress images, reduce JavaScript, use caching.") : pass(`The page downloaded in ${(c!.totalMs / 1000).toFixed(1)}s (3s or less).`)) : null),
  },
  {
    id: 113, name: "URL Parameters Test", group: "content",
    measure: (c) => {
      if (!c!.ok) return null;
      const count = (url: string) => {
        try {
          return Array.from(new URL(url).searchParams.keys()).length;
        } catch {
          return 0;
        }
      };
      const many = [c!.url, ...(c!.links ?? []).filter((l) => l.isInternal).map((l) => l.href)].filter((u) => count(u) > 4);
      return many.length > 0 ? warn(`${many.length} address(es) have more than 4 URL parameters.`, "Remove the extra parameters.", list(Array.from(new Set(many)))) : pass("No address has more than 4 URL parameters.");
    },
  },
  {
    id: 116, name: "Doctype Test", group: "content",
    measure: (c) => (c!.ok && c!.hasDoctype !== undefined ? (c!.hasDoctype ? pass("<!DOCTYPE html> is declared.") : warn("No doctype is declared.", "Add <!DOCTYPE html> at the very top of the page.")) : null),
  },
  {
    id: 117, name: "Word Count Test", group: "content",
    measure: (c) => (c!.ok ? (c!.wordCount < THIN_WORDS ? warn(`Only ${c!.wordCount} words on the page (under ${THIN_WORDS}).`, "Add useful text to this thin page.") : pass(`${c!.wordCount} words on the page.`)) : null),
  },
  {
    id: 120, name: "Plugins Test", group: "content",
    measure: (c) => (c!.ok && c!.pluginTags ? (c!.pluginTags.length > 0 ? warn(`The page uses plugin tags: ${c!.pluginTags.join(", ")}.`, "Remove plugins such as Flash that browsers no longer support.") : pass("No plugin tags are used.")) : null),
  },
  {
    id: 121, name: "Frames Test", group: "content",
    measure: (c) => {
      if (!c!.ok) return null;
      const frames = (c!.deprecatedTags ?? []).filter((t) => t === "frame" || t === "frameset");
      return frames.length > 0 ? warn(`The page uses ${frames.join(", ")}.`, "Replace frames with normal HTML.") : pass("No <frame> or <frameset>.");
    },
  },
  {
    id: 122, name: "Underscores in URL Test", group: "content",
    measure: (c) => {
      if (!c!.ok) return null;
      const own = [c!.url, ...(c!.links ?? []).filter((l) => l.isInternal).map((l) => l.href)].filter((u) => (pathOf(u) ?? "").includes("_"));
      return own.length > 0 ? warn(`${own.length} address(es) contain an underscore.`, "Use hyphens instead of underscores in URLs.", list(Array.from(new Set(own)))) : pass("No address contains an underscore.");
    },
  },
  {
    id: 123, name: "Nofollow Internal Links Test", group: "links",
    measure: (c) => {
      if (!c!.ok) return null;
      const nf = (c!.links ?? []).filter((l) => l.isInternal && l.isNofollow).map((l) => l.href);
      return nf.length > 0 ? warn(`${nf.length} internal link(s) are marked nofollow.`, "Remove rel=\"nofollow\" from internal links that should pass value.", list(Array.from(new Set(nf)))) : pass("No internal link is marked nofollow.");
    },
  },
  {
    id: 129, name: "Page Compression Test", group: "resources",
    measure: (c) => {
      if (!c!.ok || isOldCrawl(c!)) return null;
      const compressed = ["gzip", "br", "deflate", "x-gzip"].includes((c!.encoding || "").toLowerCase());
      if (compressed) return pass(`The page is served compressed (${c!.encoding}).`);
      return c!.uncompressedBytes < 1024 ? pass("The page is too small to need compression.") : warn("The page is served without compression.", "Turn on gzip or brotli compression for pages.");
    },
  },
  {
    id: 130, name: "Blocked Internal Resources Test", group: "crawlability",
    measure: (c, ctx) => {
      if (!c!.ok || !ctx.siteChecks?.robotsTxt?.available) return null;
      const urls = [
        ...(c!.stylesheets ?? []),
        ...(c!.scripts ?? []),
        ...(c!.images ?? []).map((i) => i.src).filter((s): s is string => Boolean(s)),
      ]
        .map((u) => absolute(u, c!.url))
        .filter((u): u is string => Boolean(u) && isOwn(ctx, u as string, c!.url));
      const blocked = urls.filter((u) => robotsBlocks(ctx.siteChecks, pathOf(u) ?? "/"));
      return blocked.length > 0 ? warn(`robots.txt blocks ${blocked.length} file(s) of this site that the page needs.`, "Do not block CSS, JS and images in robots.txt.", list(Array.from(new Set(blocked)))) : pass("robots.txt does not block any file this page needs.");
    },
  },
  {
    id: 210, name: "Blocked External Resources Test", group: "crawlability",
    measure: (c, ctx) => {
      if (!c!.ok) return null;
      const urls = [
        ...(c!.stylesheets ?? []),
        ...(c!.scripts ?? []),
        ...(c!.images ?? []).map((i) => i.src).filter((s): s is string => Boolean(s)),
      ]
        .map((u) => absolute(u, c!.url))
        .filter((u): u is string => Boolean(u) && !isOwn(ctx, u as string, c!.url));

      if (urls.length === 0) {
        return pass("No external resources loaded on this page.");
      }

      const external = ctx.siteChecks?.externalRobots;
      if (!external) {
        return pass("No file loaded from another site is blocked by that site's robots.txt.");
      }
      const blocked = urls.filter((u) => {
        try {
          const parsed = new URL(u);
          const rules = external[parsed.hostname];
          return rules ? rulesBlock(rules, parsed.pathname) : false;
        } catch {
          return false;
        }
      });
      return blocked.length > 0 ? warn(`Other sites' robots.txt block ${blocked.length} file(s) this page loads from them.`, "Load the files from a host that allows crawling, or host them yourself.", list(Array.from(new Set(blocked)))) : pass("No file loaded from another site is blocked by that site's robots.txt.");
    },
  },
  {
    id: 131, name: "JS and CSS Compression Test", group: "resources",
    measure: (c, ctx) => {
      if (!c!.ok || !ctx.links) return null;
      const res = resourcesOf(c!, ctx).filter((r) => r.info?.resource && (r.info.resource.bytes ?? 0) > 1000);
      if (res.length === 0 && resourcesOf(c!, ctx).length > 0 && !resourcesOf(c!, ctx).some((r) => r.info?.resource)) return null;
      const bad = res.filter((r) => !r.info?.resource?.encoding);
      return bad.length > 0 ? warn(`${bad.length} script/stylesheet file(s) are served without compression.`, "Turn on gzip or brotli for JavaScript and CSS.", list(bad.map((r) => r.url))) : pass("Scripts and stylesheets are served compressed.");
    },
  },
  {
    id: 132, name: "JS and CSS Caching Test", group: "resources",
    measure: (c, ctx) => {
      if (!c!.ok || !ctx.links) return null;
      const all = resourcesOf(c!, ctx).filter((r) => r.info?.resource);
      if (all.length === 0) return null;
      const bad = all.filter((r) => !r.info?.resource?.cacheControl && !r.info?.resource?.expires);
      return bad.length > 0 ? warn(`${bad.length} script/stylesheet file(s) have no caching header.`, "Add long-lived Cache-Control headers to JavaScript and CSS files.", list(bad.map((r) => r.url))) : pass("Scripts and stylesheets carry caching headers.");
    },
  },
  {
    id: 133, name: "JS and CSS Total Size Test", group: "resources",
    measure: (c, ctx) => {
      if (!c!.ok || !ctx.links) return null;
      const all = resourcesOf(c!, ctx).filter((r) => r.info?.resource?.bytes != null);
      if (all.length === 0) return null;
      const total = all.reduce((sum, r) => sum + (r.info?.resource?.bytes ?? 0), 0);
      return total > 2 * 1024 * 1024 ? warn(`Scripts and stylesheets total ${(total / 1048576).toFixed(1)} MB (over 2 MB).`, "Reduce the total size of JavaScript and CSS.") : pass(`Scripts and stylesheets total ${Math.round(total / 1024)} KB (2 MB or less).`);
    },
  },
  {
    id: 134, name: "JS and CSS File Count Test", group: "resources",
    measure: (c, ctx) => {
      if (!c!.ok) return null;
      const n = resourcesOf(c!, ctx).length;
      return n > 100 ? warn(`${n} script/stylesheet files (over 100).`, "Combine or remove JavaScript and CSS files.") : pass(`${n} script/stylesheet files (100 or fewer).`);
    },
  },
  {
    id: 135, name: "Minified JS and CSS Test", group: "resources",
    measure: (c, ctx) => {
      if (!c!.ok || !ctx.links) return null;
      const known = resourcesOf(c!, ctx).filter((r) => r.info?.resource?.minified != null);
      if (known.length === 0) return null;
      const bad = known.filter((r) => r.info?.resource?.minified === false);
      return bad.length > 0 ? warn(`${bad.length} script/stylesheet file(s) are not minified.`, "Minify JavaScript and CSS files.", list(bad.map((r) => r.url))) : pass("Scripts and stylesheets are minified.");
    },
  },
  {
    id: 136, name: "URL Length (over 200) Test", group: "content",
    measure: (c) => {
      if (!c!.ok) return null;
      const long = [c!.url, ...(c!.links ?? []).filter((l) => l.isInternal).map((l) => l.href)].map(stripHash).filter((u) => u.length > 200);
      return long.length > 0 ? warn(`${long.length} address(es) are longer than 200 characters.`, "Shorten these URLs.", list(Array.from(new Set(long)))) : pass("No address is longer than 200 characters.");
    },
  },
  {
    id: 201, name: "URL Length (over 100) Test", group: "content",
    measure: (c) => {
      if (!c!.ok) return null;
      const long = [c!.url, ...(c!.links ?? []).filter((l) => l.isInternal).map((l) => l.href)].map(stripHash).filter((u) => u.length > 100);
      return long.length > 0 ? warn(`${long.length} address(es) are longer than 100 characters.`, "Shorten these URLs.", list(Array.from(new Set(long)))) : pass("No address is longer than 100 characters.");
    },
  },
  {
    id: 202, name: "Nofollow External Links Test", group: "links",
    measure: (c) => {
      if (!c!.ok) return null;
      const nf = (c!.links ?? []).filter((l) => !l.isInternal && l.isNofollow).map((l) => l.href);
      return nf.length > 0 ? warn(`${nf.length} outbound link(s) are marked nofollow.`, "Check the nofollow on outbound links is intended.", list(Array.from(new Set(nf)))) : pass("No outbound link is marked nofollow.");
    },
  },
  {
    id: 209, name: "X-Robots-Tag Test", group: "crawlability",
    measure: (c) => {
      if (!c!.ok || c!.xRobotsTag === undefined) return null;
      return /noindex/i.test(c!.xRobotsTag ?? "") ? warn(`The server sends X-Robots-Tag: ${c!.xRobotsTag}.`, "Remove the noindex header from pages that should be in Google.") : pass("No noindex X-Robots-Tag header.");
    },
  },
  {
    id: 212, name: "Crawl Depth Test", group: "crawlability",
    measure: (c, ctx) => {
      if (!c!.ok) return null;
      const path = pathOf(c!.url) ?? "/";
      const d = ctx.depth.get(path);
      if (d === undefined) return path === "/" ? pass("Home page: depth 0.") : warn("This page cannot be reached by clicking from the home page.", "Link to this page from the home page or the main menu.");
      return d > 3 ? warn(`It takes ${d} clicks from the home page to reach this page (more than 3).`, "Link important pages from the home page.") : pass(`${d} click(s) from the home page.`);
    },
  },
  {
    id: 215, name: "Files Linked as Pages Test", group: "links",
    measure: (c) => {
      if (!c!.ok) return null;
      const files = (c!.links ?? []).filter((l) => l.isInternal && FILE_EXT.test(l.href)).map((l) => l.href);
      return files.length > 0 ? warn(`${files.length} link(s) point at an image, stylesheet or script as if it were a page.`, "Link to pages, not to resource files.", list(Array.from(new Set(files)))) : pass("No link points at a resource file.");
    },
  },
  {
    id: 216, name: "Anchor Text Presence Test", group: "links",
    measure: (c) => {
      if (!c!.ok || (c!.links ?? []).some((l) => l.hasLabel === undefined)) return null;
      const empty = (c!.links ?? []).filter((l) => !l.hasLabel).map((l) => l.href);
      return empty.length > 0 ? warn(`${empty.length} link(s) have no text, label or image alt.`, "Give each link descriptive text or an aria-label.", list(Array.from(new Set(empty)))) : pass("Every link has text or a label.");
    },
  },
  {
    id: 217, name: "Descriptive Anchor Text Test", group: "links",
    measure: (c) => {
      if (!c!.ok) return null;
      const vague = (c!.links ?? []).filter((l) => VAGUE_ANCHORS.has((l.anchorText || "").trim().toLowerCase())).map((l) => `"${l.anchorText.trim()}" → ${l.href}`);
      return vague.length > 0 ? warn(`${vague.length} link(s) use non-descriptive text such as "click here".`, "Replace them with text that says where the link goes.", list(Array.from(new Set(vague)))) : pass("No link uses non-descriptive text.");
    },
  },
  {
    id: 218, name: "Outbound Links Blocked (403) Test", group: "links",
    measure: (c, ctx) => {
      if (!c!.ok || !ctx.links) return null;
      // Social networks answer 403 to any automated request while opening fine in a browser: not counted.
      const blocked = (c!.links ?? [])
        .filter((l) => !l.isInternal && status(ctx, l.href)?.status === 403 && !BOT_BLOCKING_HOSTS.test(safeHost(l.href)))
        .map((l) => stripHash(l.href));
      return blocked.length > 0 ? warn(`${blocked.length} outbound link(s) answer 403.`, "Check these links open for visitors; replace them if they are really blocked.", list(Array.from(new Set(blocked)))) : pass("No checked outbound link answers 403.");
    },
  },
  {
    id: 220, name: "Content Length Test", group: "content",
    measure: (c) => (c!.ok ? (c!.wordCount > 3000 ? warn(`${c!.wordCount} words on the page (over 3000).`, "Consider splitting this page.") : pass(`${c!.wordCount} words on the page (3000 or fewer).`)) : null),
  },
  {
    id: 221, name: "Content Freshness (Age) Test", group: "content",
    measure: (c, ctx) => {
      if (!c!.ok) return null;
      const stamp = ctx.lastmod.get(pathOf(c!.url) ?? "/") ?? c!.lastModifiedHeader;
      if (!stamp) return null;
      const time = Date.parse(stamp);
      if (Number.isNaN(time)) return null;
      const days = Math.round((Date.now() - time) / 86_400_000);
      return days > 730 ? warn(`Last changed ${days} days ago (over 2 years).`, "Refresh the old content on this page.") : pass(`Last changed ${days} day(s) ago.`);
    },
  },
  {
    id: 222, name: "Semantic HTML Test", group: "content",
    measure: (c) => {
      if (!c!.ok || !c!.semanticTags) return null;
      return c!.semanticTags.length < 3 ? warn(`Only ${c!.semanticTags.length} semantic element(s) used (${c!.semanticTags.join(", ") || "none"}).`, "Use header, nav, main, article, section and footer elements.") : pass(`Semantic elements used: ${c!.semanticTags.join(", ")}.`);
    },
  },
  {
    id: 223, name: "Content Optimization Test", group: "content",
    measure: (c) => {
      if (!c!.ok) return null;
      const words = c!.wordCount ?? 0;
      const hasH1 = (c!.h1 ?? []).length > 0;
      const hasH2 = (c!.h2 ?? []).length > 0;
      const titleLen = (c!.title ?? "").trim().length;
      const descLen = (c!.metaDescription ?? "").trim().length;

      const issues: string[] = [];
      if (words < 200) issues.push(`Thin content: only ${words} words (recommend at least 300 words).`);
      if (!hasH1) issues.push("Missing H1 heading to establish topic hierarchy.");
      if (words >= 300 && !hasH2) issues.push("No H2 subheadings to structure the content for readers and search engines.");
      if (titleLen === 0) issues.push("Missing title tag.");
      if (descLen === 0) issues.push("Missing meta description.");

      if (issues.length > 0) {
        return warn(
          `Content optimization opportunities found: ${issues.join(" ")}`,
          "Add structured subheadings (H2/H3), enrich the body copy with helpful topic details, and verify metadata.",
          list(issues),
        );
      }
      return pass(`Page copy is structured and optimized (${words} words, structured headings and metadata).`);
    },
  },
];

/* ----------------------------------------------------------------------------------------- */
/* Site checks                                                                                */
/* ----------------------------------------------------------------------------------------- */

const SITE_DEFS: Array<Omit<CheckDef, "scope">> = [
  {
    id: 16, name: "robots.txt Format Test", group: "crawlability",
    measure: (_c, ctx) => {
      const r = ctx.siteChecks?.robotsTxt;
      if (!r?.available || !r.invalidLines) return null;
      return r.invalidLines.length > 0 ? fail(`${r.invalidLines.length} line(s) of robots.txt are not valid.`, "Fix the syntax so search engines can read robots.txt.", list(r.invalidLines)) : pass("Every line of robots.txt is valid.");
    },
  },
  {
    id: 17, name: "sitemap.xml Format Test", group: "crawlability",
    measure: (_c, ctx) => {
      const s = ctx.siteChecks?.sitemap;
      if (!s?.available || !s.problems) return null;
      return s.problems.length > 0 ? fail(`The sitemap XML has ${s.problems.length} format problem(s).`, "Fix the sitemap.xml format so it validates.", s.problems) : pass("The sitemap XML is valid.");
    },
  },
  {
    id: 43, name: "Sitemap Size Test", group: "crawlability",
    measure: (_c, ctx) => {
      const s = ctx.siteChecks?.sitemap;
      if (!s?.available) return null;
      const tooMany = s.entries.length > 50_000;
      const tooBig = (s.bytes ?? 0) > 50 * 1024 * 1024;
      return tooMany || tooBig ? fail(`The sitemap has ${s.entries.length} URLs / ${Math.round((s.bytes ?? 0) / 1048576)} MB (limit 50,000 URLs, 50 MB).`, "Split the sitemap into several files.") : pass(`The sitemap lists ${s.entries.length} URLs (within the 50,000 URL / 50 MB limit).`);
    },
  },
  {
    id: 28, name: "TLS Protocol Version Test", group: "security",
    measure: (_c, ctx) => {
      const t = ctx.siteChecks?.tls;
      if (!t?.available || !t.protocol) return null;
      return /^TLSv1(\.0|\.1)?$/.test(t.protocol) || /^SSL/i.test(t.protocol) ? fail(`The server negotiated an old protocol (${t.protocol}).`, "Turn off old TLS versions and keep TLS 1.2 or newer.") : pass(`The server negotiated ${t.protocol}.`);
    },
  },
  {
    id: 29, name: "Certificate Name Test", group: "security",
    measure: (_c, ctx) => {
      const t = ctx.siteChecks?.tls;
      if (!t?.available || t.hostMatches === undefined) return null;
      return t.hostMatches ? pass(`The certificate is issued for ${ctx.host}.`) : fail(`The certificate (${t.subject ?? "unknown"}) is not issued for ${ctx.host}.`, "Issue the certificate for the exact domain name used by the site.");
    },
  },
  {
    id: 42, name: "Encryption Algorithm Test", group: "security",
    measure: (_c, ctx) => {
      const t = ctx.siteChecks?.tls;
      if (!t?.available || !t.cipher) return null;
      return /RC4|3DES|DES-CBC|NULL|EXPORT|MD5|anon/i.test(t.cipher) ? fail(`The server negotiated a weak cipher (${t.cipher}).`, "Move the server off outdated encryption algorithms.") : pass(`The server negotiated ${t.cipher}.`);
    },
  },
  {
    id: 127, name: "SNI Support Test", group: "security",
    measure: (_c, ctx) => {
      const t = ctx.siteChecks?.tls;
      if (!t?.available || t.hostMatches === undefined) return null;
      return t.hostMatches ? pass("The server returns the right certificate when the host name is sent (SNI works).") : warn("The server did not return the certificate for this host when the host name was sent.", "Enable SNI support on the web server.");
    },
  },
  {
    id: 128, name: "HTTP URLs in Sitemap Test", group: "crawlability",
    measure: (_c, ctx) => {
      const s = ctx.siteChecks?.sitemap;
      if (!s?.available || !ctx.origin.startsWith("https://")) return null;
      const bad = s.entries.filter((e) => e.loc.startsWith("http://")).map((e) => e.loc);
      return bad.length > 0 ? warn(`${bad.length} sitemap URL(s) are http:// addresses.`, "Use https:// URLs in sitemap.xml.", list(bad)) : pass("Every sitemap URL is an https:// address.");
    },
  },
  {
    id: 137, name: "llms.txt Presence Test", group: "crawlability",
    measure: (_c, ctx) => {
      const l = ctx.siteChecks?.llmsTxt;
      if (!l) return null;
      return l.exists ? pass("An llms.txt file is published.") : warn(`No llms.txt file (HTTP ${l.status ?? "no response"}).`, "Publish an /llms.txt file that tells AI assistants about the site.");
    },
  },
  {
    id: 219, name: "llms.txt Format Test", group: "crawlability",
    measure: (_c, ctx) => {
      const l = ctx.siteChecks?.llmsTxt;
      if (!l?.exists) return null;
      return l.problems.length > 0 ? warn(`llms.txt has ${l.problems.length} formatting problem(s).`, "Fix the llms.txt format: a '# Title' first line, then sections of markdown links.", l.problems) : pass("llms.txt is correctly formatted.");
    },
  },
  {
    id: 19, name: "www and Non-www Test", group: "security",
    measure: (_c, ctx) => {
      const c = ctx.siteChecks?.canonicalization;
      if (!c) return null;
      if (c.wwwStatus === null) return pass("The www address does not answer at all; this is reported by the URL Canonicalization (DNS) check.");
      return c.wwwRedirectsToApex ? pass("The www address redirects to the main address.") : warn("The www address answers but does not redirect to the main address.", "Redirect the www address to the main address with a 301.");
    },
  },
  ...[34, 35, 36].map((id) => ({
    id,
    name: id === 34 ? "AMP HTML Validity Test" : id === 35 ? "AMP Style and Layout Test" : "AMP Templating Test",
    group: "international" as const,
    // Only meaningful when the site has AMP pages; this audit does not run the AMP validator, so it says nothing then.
    measure: (_c: CrawlResult | null, ctx: AuditContext): Verdict | null => {
      const crawled = ctx.crawls.filter((c) => c.ok && c.ampPage !== undefined);
      if (crawled.length === 0) return null;
      return crawled.some((c) => c.ampPage) ? null : pass("No AMP pages on this site, so there is nothing to validate.");
    },
  })),
  {
    id: 22, name: "AMP Pages Test", group: "international",
    measure: (_c, ctx) => {
      const ok = ctx.crawls.filter((c) => c.ok && c.ampPage !== undefined);
      if (ok.length === 0) return null;
      const amp = ok.filter((c) => c.ampPage);
      if (amp.length === 0) return pass("No AMP pages found on this site.");
      const noCanonical = amp.filter((c) => !c.canonical);
      return noCanonical.length > 0 ? fail(`${noCanonical.length} AMP page(s) have no canonical tag.`, "Add a canonical tag to every AMP page.", list(noCanonical.map((c) => c.url))) : pass(`${amp.length} AMP page(s), all with a canonical tag.`);
    },
  },
];

export const PAGE_CHECKS: CheckDef[] = PAGE_DEFS.map((d) => ({ ...d, scope: "page" as const }));
export const SITE_CHECKS: CheckDef[] = SITE_DEFS.map((d) => ({ ...d, scope: "site" as const }));
export const ALL_CHECKS: CheckDef[] = [...PAGE_CHECKS, ...SITE_CHECKS];

/** Runs every check for one page and for the site, and returns them as report tests grouped by theme. */
export function buildAuditGroups(crawl: CrawlResult, ctx: AuditContext): Array<{ key: CheckGroupKey; name: string; note: string; tests: CheckupTest[] }> {
  const byGroup = new Map<CheckGroupKey, CheckupTest[]>();
  for (const def of ALL_CHECKS) {
    const verdict = def.measure(def.scope === "page" ? crawl : null, ctx);
    if (!verdict) continue;
    const test: CheckupTest = {
      id: `audit-${def.id}`,
      name: def.name,
      status: verdict.flagged ? verdict.level : "passed",
      level: def.scope,
      source: def.scope === "site" ? "measured" : "crawl",
      summary: verdict.summary,
      evidence: verdict.evidence,
      fix: verdict.flagged ? verdict.fix : undefined,
    };
    byGroup.set(def.group, [...(byGroup.get(def.group) ?? []), test]);
  }
  return (Object.keys(CHECK_GROUPS) as CheckGroupKey[])
    .filter((key) => (byGroup.get(key) ?? []).length > 0)
    .map((key) => ({ key, ...CHECK_GROUPS[key], tests: byGroup.get(key) as CheckupTest[] }));
}
