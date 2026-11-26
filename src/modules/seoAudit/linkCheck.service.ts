/**
 * Follows the links found on the crawled pages and records whether each one still works.
 *
 * A link to a page the audit already crawled reuses that crawl's status; every other link is asked with a light
 * HEAD request (GET when a server refuses HEAD). At most MAX_TARGETS links are checked per audit, internal ones
 * first, and a link that merely timed out or was refused by a bot filter (401/403/429...) is "unverified", never
 * reported as broken.
 */

import * as http from "http";
import * as https from "https";
import { URL } from "url";
import type { CrawlResult } from "./crawler.service";
import { getCrawlerUserAgent } from "../../config/seoSite";

export interface LinkStatus {
  status: number | null;
  error: string | null;
  /** Statuses of the redirects followed to reach the final answer (empty when there were none). Absent on older audits. */
  redirects?: number[];
  /** The addresses the redirects led to, in order (the last one is where the link ended up) */
  via?: string[];
  /** For scripts and stylesheets: size, compression, caching and whether the code is minified. */
  resource?: { bytes: number | null; encoding: string | null; cacheControl: string | null; expires: string | null; minified: boolean | null };
}

export type LinkStatusMap = Record<string, LinkStatus>;

const MAX_TARGETS = 120;
const MAX_IMAGES = 150;
const MAX_RESOURCES = 80;
const MAX_META_LINKS = 30;
const CONCURRENCY = 8;
const TIMEOUT_MS = 7000;
const MAX_REDIRECTS = 3;

const stripHash = (url: string): string => {
  try {
    const u = new URL(url);
    u.hash = "";
    return u.toString();
  } catch {
    return url;
  }
};

/** True only for a link that really is dead: gone (404/410), a server error, or a host that does not exist. */
export function isBrokenLink(s: LinkStatus | undefined): boolean {
  if (!s) return false;
  if (s.status !== null) return s.status === 404 || s.status === 410 || s.status >= 500;
  return /ENOTFOUND|EAI_AGAIN|ECONNREFUSED|CERT_|certificate|ERR_TLS/i.test(s.error ?? "");
}

/** Cloudflare's own addresses (email protection, challenge pages): they exist only through Cloudflare and are not links to check */
export const isCloudflareInternal = (url: string): boolean => /\/cdn-cgi\//i.test(url);

const TRANSIENT = /ENOTFOUND|EAI_AGAIN|ECONNRESET|ETIMEDOUT|ECONNREFUSED|EPIPE|socket hang up|timeout/i;

/**
 * A link is only reported dead when it stays dead: a network error, a server error or a "too many requests" is asked
 * again (twice, a little later), and a HEAD answered 404 / 5xx is confirmed with a GET (some servers do not answer HEAD).
 */
async function checkUrl(url: string): Promise<LinkStatus> {
  let last: LinkStatus = { status: null, error: "not checked" };
  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt > 0) await new Promise((r) => setTimeout(r, 1500 * attempt));
    last = await request(url, "HEAD", MAX_REDIRECTS);
    if (last.status !== null && (last.status === 404 || last.status === 410 || last.status >= 500)) {
      last = await request(url, "GET", MAX_REDIRECTS);
    }
    const transient = (last.status === null && TRANSIENT.test(last.error ?? "")) || last.status === 429 || (last.status !== null && last.status >= 500);
    if (!transient) return last;
  }
  return last;
}

function request(url: string, method: "HEAD" | "GET", redirectsLeft: number, seen: number[] = [], via: string[] = []): Promise<LinkStatus> {
  return new Promise((resolve) => {
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      resolve({ status: null, error: "Invalid URL" });
      return;
    }
    const transport = parsed.protocol === "http:" ? http : https;
    const req = transport.request(
      {
        protocol: parsed.protocol,
        hostname: parsed.hostname,
        port: parsed.port || (parsed.protocol === "http:" ? 80 : 443),
        path: `${parsed.pathname}${parsed.search}`,
        method,
        headers: { "User-Agent": getCrawlerUserAgent(), Accept: "*/*", "Accept-Encoding": "identity", Connection: "close" },
        timeout: TIMEOUT_MS,
      },
      (res) => {
        const status = res.statusCode ?? 0;
        res.destroy();
        const location = res.headers.location;
        if (status >= 300 && status < 400 && location && redirectsLeft > 0) {
          const next = new URL(location, url).toString();
          void request(next, method, redirectsLeft - 1, [...seen, status], [...via, next]).then(resolve);
          return;
        }
        if (method === "HEAD" && (status === 405 || status === 501)) {
          void request(url, "GET", redirectsLeft, seen, via).then(resolve);
          return;
        }
        resolve({ status, error: null, redirects: seen, via });
      },
    );
    req.on("timeout", () => req.destroy(new Error("timeout")));
    req.on("error", (err: NodeJS.ErrnoException) => resolve({ status: null, error: err.code || err.message, redirects: seen, via }));
    req.end();
  });
}

/** Code with real indentation and many short lines was not minified. */
export function looksUnminified(code: string): boolean {
  if (code.length < 2000) return false;
  const lines = code.split("\n");
  if (lines.length < 20) return false;
  const indented = lines.filter((l) => /^(\s{2,}|\t)\S/.test(l)).length;
  return indented / lines.length > 0.3 && code.length / lines.length < 120;
}

/** Fetches a script or stylesheet the way a browser would and records size, compression, caching and minification. */
function fetchResource(url: string, redirectsLeft: number, seen: number[] = []): Promise<LinkStatus> {
  return new Promise((resolve) => {
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      resolve({ status: null, error: "Invalid URL" });
      return;
    }
    const transport = parsed.protocol === "http:" ? http : https;
    const req = transport.request(
      {
        protocol: parsed.protocol,
        hostname: parsed.hostname,
        port: parsed.port || (parsed.protocol === "http:" ? 80 : 443),
        path: `${parsed.pathname}${parsed.search}`,
        method: "GET",
        headers: { "User-Agent": getCrawlerUserAgent(), Accept: "*/*", "Accept-Encoding": "gzip, br", Connection: "close" },
        timeout: TIMEOUT_MS,
      },
      (res) => {
        const status = res.statusCode ?? 0;
        const location = res.headers.location;
        if (status >= 300 && status < 400 && location && redirectsLeft > 0) {
          res.resume();
          void fetchResource(new URL(location, url).toString(), redirectsLeft - 1, [...seen, status]).then(resolve);
          return;
        }
        const chunks: Buffer[] = [];
        let received = 0;
        let complete = true;
        res.on("data", (chunk: Buffer) => {
          received += chunk.length;
          if (received <= 400_000) chunks.push(chunk);
          else complete = false;
        });
        const finish = () => {
          const encoding = String(res.headers["content-encoding"] || "").toLowerCase() || null;
          const lengthHeader = Number.parseInt(String(res.headers["content-length"] || ""), 10);
          let minified: boolean | null = null;
          try {
            const raw = Buffer.concat(chunks);
            const zlib = require("zlib") as typeof import("zlib");
            const body = !complete ? null : encoding === "gzip" ? zlib.gunzipSync(raw) : encoding === "br" ? zlib.brotliDecompressSync(raw) : raw;
            if (body) minified = !looksUnminified(body.toString("utf8"));
          } catch {
            minified = null;
          }
          resolve({
            status,
            error: null,
            redirects: seen,
            resource: {
              bytes: Number.isFinite(lengthHeader) ? lengthHeader : complete ? received : null,
              encoding,
              cacheControl: res.headers["cache-control"] ? String(res.headers["cache-control"]) : null,
              expires: res.headers.expires ? String(res.headers.expires) : null,
              minified,
            },
          });
        };
        res.on("end", finish);
        res.on("error", () => resolve({ status, error: "read error", redirects: seen }));
      },
    );
    req.on("timeout", () => req.destroy(new Error("timeout")));
    req.on("error", (err: NodeJS.ErrnoException) => resolve({ status: null, error: err.code || err.message, redirects: seen }));
    req.end();
  });
}

/** Status of every http(s) link found on the crawled pages (hash removed), keyed by absolute URL. */
export async function checkLinks(crawls: CrawlResult[]): Promise<LinkStatusMap> {
  const result: LinkStatusMap = {};
  for (const c of crawls) {
    const status = c.httpStatus || null;
    const entry: LinkStatus = { status, error: c.ok ? null : c.error, redirects: (c.redirects ?? []).map((r) => r.status) };
    result[stripHash(c.url)] = entry;
    if (c.finalUrl) result[stripHash(c.finalUrl)] ??= entry;
  }

  const internal: string[] = [];
  const external: string[] = [];
  const seen = new Set<string>(Object.keys(result));
  for (const c of crawls) {
    for (const link of c.links ?? []) {
      const href = stripHash(link.href);
      if (!/^https?:\/\//i.test(href) || seen.has(href) || isCloudflareInternal(href)) continue;
      seen.add(href);
      (link.isInternal ? internal : external).push(href);
    }
  }
  const targets = [...internal, ...external].slice(0, MAX_TARGETS);

  // Images, scripts, stylesheets and the page addresses named in <head> (canonical, hreflang, amphtml).
  const images = new Set<string>();
  const resources = new Set<string>();
  const meta = new Set<string>();
  for (const c of crawls) {
    if (!c.ok) continue;
    for (const img of c.images ?? []) {
      if (!img.src) continue;
      try {
        const u = stripHash(new URL(img.src, c.url).toString());
        if (/^https?:\/\//i.test(u) && !u.startsWith("data:")) images.add(u);
      } catch { /* not a usable address */ }
    }
    for (const r of [...(c.stylesheets ?? []), ...(c.scripts ?? [])]) resources.add(stripHash(r));
    for (const m of [c.canonical, c.ampHtmlUrl, ...(c.hreflang ?? []).map((h) => h.href)]) {
      if (!m) continue;
      try {
        meta.add(stripHash(new URL(m, c.url).toString()));
      } catch { /* not a usable address */ }
    }
  }
  const imageTargets = [...images].filter((u) => !result[u]).slice(0, MAX_IMAGES);
  const resourceTargets = [...resources].slice(0, MAX_RESOURCES);
  const metaTargets = [...meta].filter((u) => !result[u] && !targets.includes(u)).slice(0, MAX_META_LINKS);

  const jobs: Array<() => Promise<void>> = [
    ...targets.map((url) => async () => void (result[url] = await checkUrl(url))),
    ...imageTargets.map((url) => async () => void (result[url] = await checkUrl(url))),
    ...metaTargets.map((url) => async () => void (result[url] = await checkUrl(url))),
    // Resources use their own, fuller request (headers and a look at the code), so they override a plain status.
    ...resourceTargets.map((url) => async () => void (result[url] = await fetchResource(url, MAX_REDIRECTS))),
  ];
  let next = 0;
  const worker = async () => {
    while (next < jobs.length) {
      const job = jobs[next++];
      await job();
    }
  };
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, jobs.length) }, worker));
  return result;
}

/** Links of one page that are dead, split into our own site's and other sites'. */
export function brokenLinksOf(crawl: CrawlResult, statuses: LinkStatusMap): { internal: Array<{ href: string; status: string }>; external: Array<{ href: string; status: string }>; checked: number } {
  const internal: Array<{ href: string; status: string }> = [];
  const external: Array<{ href: string; status: string }> = [];
  const seen = new Set<string>();
  let checked = 0;
  for (const link of crawl.links ?? []) {
    const href = stripHash(link.href);
    if (seen.has(href) || isCloudflareInternal(href)) continue;
    seen.add(href);
    const status = statuses[href];
    if (!status) continue;
    checked += 1;
    if (isBrokenLink(status)) {
      const base = status.status !== null ? String(status.status) : status.error || "no response";
      const last = status.via?.length ? status.via[status.via.length - 1] : null;
      // a link that is sent somewhere else and ends there: say where, so the owner sees what visitors reach
      const text = last ? `${base} (it redirects to ${last}, which ${status.status === null ? "does not answer" : `answers ${status.status}`})` : base;
      (link.isInternal ? internal : external).push({ href, status: text });
    }
  }
  return { internal, external, checked };
}

/** Stored as a list: a web address makes a poor database key (it contains dots). */
export type LinkStatusList = Array<{ url: string } & LinkStatus>;

export const linkStatusesToList = (map: LinkStatusMap | null | undefined): LinkStatusList | null =>
  map ? Object.entries(map).map(([url, s]) => ({ url, ...s })) : null;

export const linkStatusesFromList = (list: unknown): LinkStatusMap | null => {
  if (!Array.isArray(list)) return null;
  const map: LinkStatusMap = {};
  for (const item of list as LinkStatusList) {
    if (!item?.url) continue;
    const { url, ...rest } = item;
    map[url] = { ...rest, status: rest.status ?? null, error: rest.error ?? null };
  }
  return map;
};
