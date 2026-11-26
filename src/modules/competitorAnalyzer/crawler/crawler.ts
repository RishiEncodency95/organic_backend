import { FetchBlockedError } from "../errors";
import { ANALYZER_VERSIONS } from "../config";
import type { PageKind } from "../taxonomy";
import { classifyPage, kindPriority, selectPages, type PageCandidate, type SamplingFocus } from "./classify";
import { extractPage, siteNameFrom, type PageExtract } from "./extract";
import { isAllowed, parseRobots, PRODUCT_TOKEN, type RobotsPolicy } from "./robots";
import type { Fetcher, SafeFetchResult } from "./safeFetch";
import { parseSitemap } from "./sitemap";
import { isSkippablePath, normalizePageUrl, normalizeSite, sameSite } from "./url";

/*
 * Bounded site sample crawler. A run reads at most `maxPages` prioritised public pages of one site; it is a SAMPLE,
 * not a full crawl, and the coverage block says exactly what was and was not read. Robots rules are enforced (not
 * just detected). Off-site redirects stop the crawl so a different business's evidence is never mixed in.
 * The crawler only issues GET requests; it never submits forms, logs in, or follows tel:/mailto:/WhatsApp links.
 */

export type PageFetchState = "read" | "fetch_failed" | "http_error" | "robots_disallowed" | "not_html" | "render_failed" | "skipped_cancelled";

export interface CrawledPage {
  url: string;
  finalUrl: string | null;
  kind: PageKind;
  source: PageCandidate["source"];
  state: PageFetchState;
  httpStatus: number | null;
  method: "static" | "rendered";
  fetchedAt: string;
  elapsedMs: number | null;
  redirectChain: { url: string; status: number }[];
  truncated: boolean;
  error: string | null;
  /** Present only when state === "read" */
  extract: PageExtract | null;
}

export interface CrawlCoverage {
  discovered: number;
  selected: number;
  read: number;
  failed: number;
  robotsBlocked: number;
  jsShellPages: number;
  rendered: number;
  pageKinds: PageKind[];
  missingPriorityKinds: PageKind[];
  status: "complete" | "partial" | "insufficient";
  warnings: string[];
}

export interface SiteCrawl {
  inputUrl: string;
  rootUrl: string;
  domain: string;
  state: "ok" | "unreachable" | "blocked" | "robots_disallowed" | "redirected_offsite" | "cancelled";
  error: string | null;
  movedTo: string | null;
  https: boolean;
  siteName: string | null;
  robots: { status: RobotsPolicy["status"]; httpStatus: number | null; sitemaps: string[]; crawlDelaySec: number | null; rulesCount: number };
  sitemap: { found: boolean; urls: string[]; entryCount: number; latestLastmod: string | null; recent30: number | null; recent90: number | null; sources: string[] };
  pages: CrawledPage[];
  coverage: CrawlCoverage;
  startedAt: string;
  finishedAt: string;
  crawlerVersion: string;
}

export interface Renderer {
  available(): boolean;
  /** Returns rendered HTML; must apply the same network restrictions as safeFetch to every subrequest. */
  render(url: string): Promise<string | { html: string; url: string }>;
}

export interface CrawlOptions {
  focus?: SamplingFocus;
  maxPages: number;
  fetcher: Fetcher;
  timeoutMs?: number;
  maxBytes?: number;
  delayMs?: number;
  siteTimeoutMs?: number;
  renderer?: Renderer | null;
  isCancelled?: () => Promise<boolean> | boolean;
  now?: () => Date;
  sleep?: (ms: number) => Promise<void>;
  userAgent?: string;
  /** Discovery verification reads only the home page and robots.txt. */
  skipSitemap?: boolean;
}

const PRIORITY_KINDS: PageKind[] = ["home", "services", "contact", "about", "pricing"];
const defaultSleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
const isHtml = (r: SafeFetchResult) => !r.contentType || /text\/html|application\/xhtml/.test(r.contentType) || /^\s*<(!doctype html|html)/i.test(r.body.slice(0, 200));

function emptyCoverage(warnings: string[]): CrawlCoverage {
  return { discovered: 0, selected: 0, read: 0, failed: 0, robotsBlocked: 0, jsShellPages: 0, rendered: 0, pageKinds: [], missingPriorityKinds: PRIORITY_KINDS, status: "insufficient", warnings };
}

export async function crawlSite(input: string, opts: CrawlOptions): Promise<SiteCrawl> {
  const now = opts.now ?? (() => new Date());
  const sleep = opts.sleep ?? defaultSleep;
  const startedAt = now().toISOString();
  const deadline = Date.now() + (opts.siteTimeoutMs ?? 150_000);
  const headers = { "user-agent": opts.userAgent ?? `${PRODUCT_TOKEN}/1.0` };
  const fetchOpts = { timeoutMs: opts.timeoutMs, maxBytes: opts.maxBytes, headers };
  const site = normalizeSite(input);
  const base: Omit<SiteCrawl, "state" | "error" | "pages" | "coverage" | "finishedAt"> = {
    inputUrl: input,
    rootUrl: site?.url ?? input,
    domain: site?.domain ?? "",
    movedTo: null,
    https: site ? site.url.startsWith("https:") : false,
    siteName: null,
    robots: { status: "unreachable", httpStatus: null, sitemaps: [], crawlDelaySec: null, rulesCount: 0 },
    sitemap: { found: false, urls: [], entryCount: 0, latestLastmod: null, recent30: null, recent90: null, sources: [] },
    startedAt,
    crawlerVersion: ANALYZER_VERSIONS.crawler,
  };
  const finish = (state: SiteCrawl["state"], error: string | null, pages: CrawledPage[], coverage: CrawlCoverage): SiteCrawl => ({
    ...base,
    state,
    error,
    pages,
    coverage,
    finishedAt: now().toISOString(),
  });
  if (!site) return finish("blocked", "Invalid or non-public website address.", [], emptyCoverage(["Invalid URL"]));
  const cancelled = async () => (opts.isCancelled ? await opts.isCancelled() : false);

  // 1. robots.txt
  let policy: RobotsPolicy = { status: "unreachable", rules: [], sitemaps: [], crawlDelaySec: null };
  try {
    const r = await opts.fetcher(new URL("/robots.txt", site.url).href, { ...fetchOpts, maxBytes: 500_000 });
    base.robots.httpStatus = r.status;
    if (r.ok && !/text\/html/.test(r.contentType)) policy = parseRobots(r.body);
    else if (r.status >= 400 && r.status < 500) policy = { status: "missing", rules: [], sitemaps: [], crawlDelaySec: null };
  } catch (e) {
    if (e instanceof FetchBlockedError) return finish("blocked", e.message, [], emptyCoverage([e.message]));
    // network failure: recorded as unreachable; crawl proceeds (RFC 9309 allows treating it as no info) but flagged
  }
  base.robots = { ...base.robots, status: policy.status, sitemaps: policy.sitemaps, crawlDelaySec: policy.crawlDelaySec, rulesCount: policy.rules.length };
  const delayMs = Math.max(opts.delayMs ?? 400, (policy.crawlDelaySec ?? 0) * 1000);
  const warnings: string[] = [];
  if (policy.status === "unreachable") warnings.push("robots.txt could not be read; crawl limited to the configured page budget.");

  if (!isAllowed(policy, "/")) {
    const page: CrawledPage = { url: site.url, finalUrl: null, kind: "home", source: "root", state: "robots_disallowed", httpStatus: null, method: "static", fetchedAt: now().toISOString(), elapsedMs: null, redirectChain: [], truncated: false, error: "Disallowed by robots.txt", extract: null };
    return finish("robots_disallowed", "The site's robots.txt disallows reading the home page.", [page], { ...emptyCoverage(["Home page disallowed by robots.txt"]), selected: 1, robotsBlocked: 1 });
  }

  // 2. home page
  const pages: CrawledPage[] = [];
  const fetchPage = async (c: PageCandidate): Promise<CrawledPage> => {
    const fetchedAt = now().toISOString();
    const rec: CrawledPage = { url: c.url, finalUrl: null, kind: c.kind, source: c.source, state: "fetch_failed", httpStatus: null, method: "static", fetchedAt, elapsedMs: null, redirectChain: [], truncated: false, error: null, extract: null };
    try {
      const r = await opts.fetcher(c.url, fetchOpts);
      rec.httpStatus = r.status;
      rec.finalUrl = r.url;
      rec.elapsedMs = r.elapsedMs;
      rec.redirectChain = r.redirectChain;
      rec.truncated = r.truncated;
      if (!r.ok) {
        rec.state = "http_error";
        rec.error = `HTTP ${r.status}`;
        return rec;
      }
      if (!isHtml(r)) {
        rec.state = "not_html";
        rec.error = `Not an HTML page (${r.contentType || "unknown type"})`;
        return rec;
      }
      let extract = extractPage(r.body, r.url, now());
      if (extract.looksLikeJsShell && opts.renderer?.available()) {
        try {
          const rendered = await opts.renderer.render(r.url);
          const finalUrl = typeof rendered === "string" ? r.url : rendered.url;
          rec.finalUrl = finalUrl;
          if (!sameSite(new URL(finalUrl).hostname, new URL(site.url).hostname)) {
            rec.state = "fetch_failed";
            rec.error = "Browser redirected to a different website; content was not attributed to this site.";
            return rec;
          }
          if (!isAllowed(policy, new URL(finalUrl).pathname)) {
            rec.state = "robots_disallowed";
            rec.error = "Rendered destination is disallowed by robots.txt";
            return rec;
          }
          extract = extractPage(typeof rendered === "string" ? rendered : rendered.html, finalUrl, now());
          rec.method = "rendered";
        } catch (e) {
          rec.state = "render_failed";
          rec.error = `Rendering failed: ${(e as Error).message}`.slice(0, 300);
          rec.extract = extract;
          return rec;
        }
      }
      rec.state = "read";
      rec.extract = extract;
      return rec;
    } catch (e) {
      rec.state = "fetch_failed";
      rec.error = (e as Error).message.slice(0, 300);
      return rec;
    }
  };

  const home = await fetchPage({ url: site.url, kind: "home", source: "root", label: "", priority: 100 });
  pages.push(home);
  if (home.finalUrl && !sameSite(new URL(home.finalUrl).hostname, new URL(site.url).hostname)) {
    base.movedTo = home.finalUrl;
    home.extract = null;
    home.state = "fetch_failed";
    home.error = `Redirected to a different website (${new URL(home.finalUrl).hostname}); not read.`;
    return finish("redirected_offsite", home.error, pages, { ...emptyCoverage([home.error]), selected: 1, failed: 1 });
  }
  if (home.state !== "read" && home.state !== "render_failed") {
    return finish("unreachable", home.error ?? "Home page could not be read.", pages, { ...emptyCoverage([home.error ?? "Home page unreadable"]), selected: 1, failed: 1 });
  }
  const homeUrl = new URL(home.finalUrl ?? site.url);
  base.https = homeUrl.protocol === "https:";
  base.siteName = home.extract ? siteNameFrom(home.extract) : null;

  // 3. sitemap discovery (bounded)
  const sitemapSources = opts.skipSitemap ? [] : [...new Set([...policy.sitemaps, new URL("/sitemap.xml", homeUrl).href])].slice(0, 5);
  const sitemapPages: { loc: string; lastmod: string | null }[] = [];
  const queue = [...sitemapSources];
  const visited = new Set<string>();
  while (queue.length && visited.size < 6 && sitemapPages.length < 5_000 && Date.now() < deadline) {
    const sm = queue.shift() as string;
    if (visited.has(sm)) continue;
    visited.add(sm);
    try {
      const smUrl = new URL(sm);
      if (!sameSite(smUrl.hostname, homeUrl.hostname)) continue;
      const r = await opts.fetcher(sm, { ...fetchOpts, maxBytes: 5_000_000 });
      if (!r.ok) continue;
      const parsed = parseSitemap(r.body);
      if (parsed.pages.length || parsed.children.length) base.sitemap.sources.push(sm);
      sitemapPages.push(...parsed.pages.slice(0, 5_000 - sitemapPages.length));
      queue.push(...parsed.children.slice(0, 5));
    } catch {
      /* sitemap missing / blocked: recorded via found=false */
    }
  }
  const lastmods = sitemapPages.map((p) => (p.lastmod ? new Date(p.lastmod) : null)).filter((d): d is Date => !!d && !Number.isNaN(d.getTime()));
  const cutoff = now().getTime() - 90 * 86_400_000;
  const cutoff30 = now().getTime() - 30 * 86_400_000;
  base.sitemap = {
    found: base.sitemap.sources.length > 0,
    urls: sitemapPages.slice(0, 200).map((p) => p.loc),
    entryCount: sitemapPages.length,
    latestLastmod: lastmods.length ? new Date(Math.max(...lastmods.map((d) => d.getTime()))).toISOString().slice(0, 10) : null,
    recent30: lastmods.length ? lastmods.filter((d) => d.getTime() >= cutoff30).length : null,
    recent90: lastmods.length ? lastmods.filter((d) => d.getTime() >= cutoff).length : null,
    sources: base.sitemap.sources,
  };

  // 4. candidate selection
  const candidates: PageCandidate[] = [];
  const pushCandidate = (raw: string, label: string, source: PageCandidate["source"]) => {
    const norm = normalizePageUrl(raw, homeUrl);
    if (!norm) return;
    const u = new URL(norm);
    if (!sameSite(u.hostname, homeUrl.hostname) || isSkippablePath(u.pathname)) return;
    if (normalizePageUrl(homeUrl.href) === norm) return;
    const kind = classifyPage(norm, label);
    candidates.push({ url: norm, kind, label, source, priority: kindPriority(kind) });
  };
  for (const l of home.extract?.internalLinks ?? []) pushCandidate(l.href, l.text, "home_link");
  for (const p of sitemapPages.slice(0, 2_000)) pushCandidate(p.loc, "", "sitemap");
  const discovered = new Set(candidates.map((c) => c.url)).size + 1;
  const allowed: PageCandidate[] = [];
  let robotsBlocked = 0;
  const blockedRecords: CrawledPage[] = [];
  for (const c of candidates) {
    const u = new URL(c.url);
    if (isAllowed(policy, `${u.pathname}${u.search}`)) allowed.push(c);
    else if (!blockedRecords.some((b) => b.url === c.url)) {
      robotsBlocked += 1;
      if (blockedRecords.length < 20) blockedRecords.push({ url: c.url, finalUrl: null, kind: c.kind, source: c.source, state: "robots_disallowed", httpStatus: null, method: "static", fetchedAt: now().toISOString(), elapsedMs: null, redirectChain: [], truncated: false, error: "Disallowed by robots.txt", extract: null });
    }
  }
  const selected = selectPages(allowed, Math.max(0, opts.maxPages - 1), opts.focus);

  // 5. read selected pages sequentially (per-domain politeness delay)
  let wasCancelled = false;
  for (const c of selected) {
    if (await cancelled()) {
      wasCancelled = true;
      break;
    }
    if (Date.now() > deadline) {
      warnings.push("Site time budget reached; remaining selected pages were not read.");
      pages.push({ url: c.url, finalUrl: null, kind: c.kind, source: c.source, state: "fetch_failed", httpStatus: null, method: "static", fetchedAt: now().toISOString(), elapsedMs: null, redirectChain: [], truncated: false, error: "Site time budget exceeded", extract: null });
      continue;
    }
    if (delayMs) await sleep(delayMs);
    const rec = await fetchPage(c);
    if (rec.finalUrl && !sameSite(new URL(rec.finalUrl).hostname, homeUrl.hostname)) {
      rec.state = "fetch_failed";
      rec.error = "Redirected off-site; not read.";
      rec.extract = null;
    }
    pages.push(rec);
  }

  const read = pages.filter((p) => p.state === "read");
  const kinds = [...new Set(read.map((p) => p.kind))];
  const jsShell = pages.filter((p) => p.extract?.looksLikeJsShell && p.method === "static").length;
  if (jsShell) warnings.push(`${jsShell} page(s) look JavaScript-rendered and contain little static text${opts.renderer?.available() ? "" : "; browser rendering is not available, so their content is not observed"}.`);
  const missingPriorityKinds = PRIORITY_KINDS.filter((k) => !kinds.includes(k));
  const failed = pages.filter((p) => p.state !== "read").length;
  if (failed) warnings.push(`${failed} selected page(s) could not be read.`);
  if (robotsBlocked) warnings.push(`${robotsBlocked} candidate page(s) skipped because robots.txt disallows them.`);
  const status: CrawlCoverage["status"] = read.length === 0 ? "insufficient" : missingPriorityKinds.length <= 1 && failed === 0 && jsShell === 0 ? "complete" : "partial";
  const coverage: CrawlCoverage = {
    discovered,
    selected: selected.length + 1,
    read: read.length,
    failed,
    robotsBlocked,
    jsShellPages: jsShell,
    rendered: pages.filter((p) => p.method === "rendered").length,
    pageKinds: kinds,
    missingPriorityKinds,
    status,
    warnings,
  };
  return finish(wasCancelled ? "cancelled" : "ok", null, [...pages, ...blockedRecords], coverage);
}
