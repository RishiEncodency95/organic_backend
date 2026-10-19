/**
 * Real on-page crawler.
 *
 * Fetches a live URL over the network, measures true timings (TTFB, total),
 * records the transferred bytes and parses the served HTML with cheerio.
 * Every value produced here was observed on the wire at `fetchedAt`.
 */

import * as https from "https";
import * as http from "http";
import { URL } from "url";
import * as cheerio from "cheerio";

export interface HttpFetchResult {
  requestedUrl: string;
  finalUrl: string;
  status: number;
  headers: http.IncomingHttpHeaders;
  body: string;
  transferredBytes: number;
  uncompressedBytes: number;
  encoding: string;
  ttfbMs: number;
  totalMs: number;
  redirects: Array<{ url: string; status: number }>;
  httpVersion: string;
}

export interface CrawlLink {
  href: string;
  rawHref: string;
  anchorText: string;
  rel: string | null;
  target: string | null;
  isInternal: boolean;
  isNofollow: boolean;
  unsafeBlank: boolean;
}

export interface CrawlImage {
  src: string | null;
  alt: string | null;
  hasAlt: boolean;
  width: string | null;
  height: string | null;
  srcset: string | null;
  loading: string | null;
}

export interface CrawlResult {
  ok: boolean;
  error: string | null;
  requestedPath: string;
  url: string;
  finalUrl: string;
  httpStatus: number;
  httpVersion: string;
  fetchedAt: string;
  ttfbMs: number;
  totalMs: number;
  transferredBytes: number;
  uncompressedBytes: number;
  encoding: string;
  domNodes: number;
  title: string | null;
  titleLength: number;
  metaDescription: string | null;
  descriptionLength: number;
  metaKeywords: string | null;
  canonical: string | null;
  canonicalCount: number;
  canonicalStatus: "missing" | "self" | "points_elsewhere";
  robotsMeta: string | null;
  indexable: boolean;
  nofollowMeta: boolean;
  viewport: string | null;
  charset: string | null;
  htmlLang: string | null;
  metaRefresh: boolean;
  openGraph: Record<string, string | null>;
  twitter: Record<string, string | null>;
  jsonLdTypes: string[];
  jsonLdBlocks: number;
  jsonLdValid: boolean;
  jsonLdError: string | null;
  h1: string[];
  h2: string[];
  h3: string[];
  headingSequence: Array<{ level: number; text: string }>;
  wordCount: number;
  links: CrawlLink[];
  internalLinksUnique: number;
  externalLinksUnique: number;
  nofollowLinks: number;
  unsafeBlankLinks: number;
  internalLinkTargets: string[];
  images: CrawlImage[];
  imagesMissingAlt: string[];
  imagesMissingSrcset: string[];
  imagesMissingDims: string[];
  favicon: boolean;
  deprecatedTags: string[];
  hreflang: Array<{ hreflang: string; href: string }>;
  stylesheets: string[];
  inlineScriptCount: number;
  syncHeadScripts: number;
  plaintextEmails: string[];
  mixedContent: string[];
  copyrightYears: number[];
  hasEventDates: boolean;
  hasCountdown: boolean;
}

const USER_AGENT =
  "BharatOrganicSEOAudit/1.0 (+real-crawl; contact: seo@bharatorganicexpo.com)";

const DEPRECATED_TAGS = [
  "center", "font", "big", "marquee", "blink", "frame", "frameset",
  "acronym", "applet", "basefont", "dir", "isindex",
];

/** Single HTTP(S) GET with redirect following, timing and byte accounting. */
export function fetchWithTiming(
  url: string,
  options: { maxRedirects?: number; timeoutMs?: number; acceptEncoding?: string } = {},
): Promise<HttpFetchResult> {
  const maxRedirects = options.maxRedirects ?? 5;
  const timeoutMs = options.timeoutMs ?? 25_000;
  // Always request identity encoding so the body is directly parseable by cheerio.
  const acceptEncoding = options.acceptEncoding ?? "identity";

  return new Promise((resolve, reject) => {
    const redirects: Array<{ url: string; status: number }> = [];

    const doRequest = (currentUrl: string, depth: number) => {
      let parsed: URL;
      try {
        parsed = new URL(currentUrl);
      } catch {
        reject(new Error(`Invalid URL: ${currentUrl}`));
        return;
      }

      const transport = parsed.protocol === "http:" ? http : https;
      const startedAt = Date.now();
      let ttfbMs: number | null = null;

      const req = transport.request(
        {
          protocol: parsed.protocol,
          hostname: parsed.hostname,
          port: parsed.port || (parsed.protocol === "http:" ? 80 : 443),
          path: `${parsed.pathname}${parsed.search}`,
          method: "GET",
          headers: {
            "User-Agent": USER_AGENT,
            Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Encoding": acceptEncoding,
            "Accept-Language": "en-US,en;q=0.9",
            Connection: "close",
          },
          timeout: timeoutMs,
        },
        (res) => {
          if (ttfbMs === null) ttfbMs = Date.now() - startedAt;

          const status = res.statusCode ?? 0;
          const location = res.headers.location;

          if (status >= 300 && status < 400 && location && depth < maxRedirects) {
            redirects.push({ url: currentUrl, status });
            res.resume();
            const next = new URL(location, currentUrl).toString();
            doRequest(next, depth + 1);
            return;
          }

          const chunks: Buffer[] = [];
          res.on("data", (chunk: Buffer) => chunks.push(chunk));
          res.on("end", () => {
            const totalMs = Date.now() - startedAt;
            const raw = Buffer.concat(chunks);
            const encoding = String(res.headers["content-encoding"] || "").toLowerCase().trim();
            // If the server sent gzip/br despite identity request, decompress here.
            let body: string;
            let uncompressedBytes = raw.length;
            if ((encoding === "gzip" || encoding === "x-gzip") && raw.length > 2 && raw[0] === 0x1f && raw[1] === 0x8b) {
              const zlib = require("zlib");
              const inflated = zlib.gunzipSync(raw);
              body = inflated.toString("utf8");
              uncompressedBytes = inflated.length;
            } else if ((encoding === "br") && raw.length > 0) {
              const zlib = require("zlib");
              try {
                const inflated = zlib.brotliDecompressSync(raw);
                body = inflated.toString("utf8");
                uncompressedBytes = inflated.length;
              } catch {
                body = raw.toString("utf8");
              }
            } else if ((encoding === "deflate") && raw.length > 0) {
              const zlib = require("zlib");
              try {
                const inflated = zlib.inflateSync(raw);
                body = inflated.toString("utf8");
                uncompressedBytes = inflated.length;
              } catch {
                body = raw.toString("utf8");
              }
            } else {
              body = raw.toString("utf8");
            }
            resolve({
              requestedUrl: url,
              finalUrl: currentUrl,
              status,
              headers: res.headers,
              body,
              transferredBytes: raw.length,
              uncompressedBytes,
              encoding: encoding || "identity",
              ttfbMs: ttfbMs ?? Date.now() - startedAt,
              totalMs,
              redirects,
              httpVersion: res.httpVersion,
            });
          });
        },
      );

      req.on("timeout", () => {
        req.destroy(new Error(`Request timed out after ${timeoutMs}ms`));
      });
      req.on("error", (err) => reject(err));
      req.end();
    };

    doRequest(url, 0);
  });
}

function absoluteUrl(href: string | null | undefined, base: string): string | null {
  if (!href) return null;
  const trimmed = href.trim();
  if (!trimmed || trimmed.startsWith("#") || trimmed.startsWith("data:") || trimmed.startsWith("mailto:") || trimmed.startsWith("tel:")) {
    return null;
  }
  try {
    return new URL(trimmed, base).toString();
  } catch {
    return null;
  }
}

function normalizeHost(host: string): string {
  return host.toLowerCase().replace(/^www\./, "");
}

function textOf($: cheerio.CheerioAPI, el: never): string {
  if (!el) return "";
  return ($(el).text() || "").replace(/\s+/g, " ").trim();
}

/** Parses the served HTML of one URL into a full real crawl record. */
export function parseHtml(path: string, res: HttpFetchResult): CrawlResult {
  const $ = cheerio.load(res.body);
  const pageUrl = res.finalUrl;

  const title = $("title").first().text().trim() || null;
  const metaDesc = $('meta[name=\"description\"]').attr("content")?.trim() || null;
  const metaKeywords = $('meta[name=\"keywords\"]').attr("content")?.trim() || null;

  const canonicals = $('link[rel=\"canonical\"]')
    .map((_, el) => $(el).attr("href")?.trim() || null)
    .get()
    .filter((v): v is string => Boolean(v));
  const canonical = canonicals[0] ?? null;
  let canonicalStatus: CrawlResult["canonicalStatus"] = "missing";
  if (canonical) {
    try {
      canonicalStatus =
        new URL(canonical, pageUrl).toString().replace(/\/$/, "") === pageUrl.replace(/\/$/, "")
          ? "self"
          : "points_elsewhere";
    } catch {
      canonicalStatus = "points_elsewhere";
    }
  }

  const robotsMeta = $('meta[name=\"robots\"]').attr("content")?.trim() || null;
  const robotsDirectives = (robotsMeta || "").toLowerCase();
  const indexable = !robotsDirectives.includes("noindex");
  const nofollowMeta = robotsDirectives.includes("nofollow");

  const viewport = $('meta[name=\"viewport\"]').attr("content")?.trim() || null;
  const charset =
    $("meta[charset]").attr("charset")?.trim() ||
    ($('meta[http-equiv=\"content-type\"]').attr("content") || null)?.match(/charset=([\w-]+)/i)?.[1] ||
    null;
  const htmlLang = $("html").attr("lang")?.trim() || null;
  const metaRefresh = $('meta[http-equiv=\"refresh\"]').length > 0;

  const og: Record<string, string | null> = {};
  $('meta[property^=\"og:\"]').each((_, el) => {
    const prop = $(el).attr("property");
    if (prop) og[prop] = $(el).attr("content")?.trim() ?? null;
  });
  const twitter: Record<string, string | null> = {};
  $('meta[name^=\"twitter:\"]').each((_, el) => {
    const name = $(el).attr("name");
    if (name) twitter[name] = $(el).attr("content")?.trim() ?? null;
  });

  let jsonLdBlocks = 0;
  let jsonLdValid = true;
  let jsonLdError: string | null = null;
  const jsonLdTypes: string[] = [];
  $('script[type=\"application/ld+json\"]').each((_, el) => {
    jsonLdBlocks += 1;
    try {
      const parsed = JSON.parse($(el).text());
      const blocks = Array.isArray(parsed) ? parsed : [parsed];
      for (const block of blocks) {
        if (block && typeof block === "object" && block["@type"]) {
          const t = block["@type"];
          if (Array.isArray(t)) t.forEach((x: unknown) => jsonLdTypes.push(String(x)));
          else jsonLdTypes.push(String(t));
        }
      }
    } catch (err) {
      jsonLdValid = false;
      jsonLdError = err instanceof Error ? err.message : "Invalid JSON-LD";
    }
  });

  const h1 = $("h1").map((_, el) => textOf($, el as never)).get().filter(Boolean);
  const h2 = $("h2").map((_, el) => textOf($, el as never)).get().filter(Boolean);
  const h3 = $("h3").map((_, el) => textOf($, el as never)).get().filter(Boolean);
  const headingSequence: Array<{ level: number; text: string }> = [];
  $("h1,h2,h3,h4,h5,h6").each((_, el) => {
    const level = Number($(el).prop("tagName")?.replace(/h/i, "") || "0");
    const text = textOf($, el as never);
    if (text) headingSequence.push({ level, text });
  });

  // Indexable word count: visible body text minus scripts/styles.
  const bodyClone = $("body").clone();
  bodyClone.find("script,style,noscript,template").remove();
  const wordCount = (bodyClone.text() || "").replace(/\s+/g, " ").trim().split(" ").filter(Boolean).length;

  const siteHost = normalizeHost(new URL(pageUrl).hostname);
  const links: CrawlLink[] = [];
  $("a[href]").each((_, el) => {
    const rawHref = $(el).attr("href")?.trim() || "";
    const abs = absoluteUrl(rawHref, pageUrl);
    if (!abs) return;
    const rel = $(el).attr("rel") || null;
    const target = $(el).attr("target") || null;
    let host = "";
    try {
      host = normalizeHost(new URL(abs).hostname);
    } catch {
      return;
    }
    const isInternal = host === siteHost;
    const relTokens = (rel || "").toLowerCase().split(/\s+/);
    links.push({
      href: abs,
      rawHref,
      anchorText: textOf($, el as never),
      rel,
      target,
      isInternal,
      isNofollow: relTokens.includes("nofollow"),
      unsafeBlank: target === "_blank" && !relTokens.includes("noopener") && !relTokens.includes("noreferrer"),
    });
  });
  const internalSet = new Set(links.filter((l) => l.isInternal).map((l) => l.href.replace(/\/$/, "")));
  const externalSet = new Set(links.filter((l) => !l.isInternal).map((l) => l.href));

  const images: CrawlImage[] = [];
  $("img").each((_, el) => {
    images.push({
      src: $(el).attr("src")?.trim() ?? null,
      alt: $(el).attr("alt") ?? null,
      hasAlt: $(el).is("[alt]"),
      width: $(el).attr("width") ?? null,
      height: $(el).attr("height") ?? null,
      srcset: $(el).attr("srcset") ?? null,
      loading: $(el).attr("loading") ?? null,
    });
  });

  const stylesheets = $("link[rel=\"stylesheet\"]")
    .map((_, el) => absoluteUrl($(el).attr("href"), pageUrl))
    .get()
    .filter((v): v is string => Boolean(v));

  let inlineScriptCount = 0;
  let syncHeadScripts = 0;
  $("script").each((_, el) => {
    const src = $(el).attr("src");
    if (!src) inlineScriptCount += 1;
    else if ($(el).closest("head").length && !$(el).is("[defer]") && !$(el).is("[async]") && $(el).attr("type") !== "module") {
      syncHeadScripts += 1;
    }
  });

  const deprecatedTags = DEPRECATED_TAGS.filter((tag) => $(tag).length > 0);

  const hreflang = $('link[rel=\"alternate\"][hreflang]')
    .map((_, el) => ({
      hreflang: $(el).attr("hreflang") || "",
      href: $(el).attr("href") || "",
    }))
    .get()
    .filter((x) => x.hreflang && x.href);

  const favicon = $('link[rel=\"icon\"], link[rel=\"shortcut icon\"], link[rel=\"apple-touch-icon\"]').length > 0;

  const emails = new Set<string>();
  $("a[href^='mailto:']").each((_, el) => {
    const m = ($(el).attr("href") || "").replace(/^mailto:/i, "").split("?")[0];
    if (m) emails.add(m.trim());
  });
  const bodyText = $("body").text() || "";
  const plainMatches = bodyText.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) || [];
  plainMatches.forEach((m) => emails.add(m));

  const mixedContent: string[] = [];
  $("[src], [href]").each((_, el) => {
    for (const attr of ["src", "href"]) {
      const val = $(el).attr(attr);
      if (val && /^http:\/\//i.test(val) && !/^http:\/\/localhost/i.test(val)) {
        mixedContent.push(val);
      }
    }
  });

  const copyrightYears = Array.from(
    new Set(
      Array.from(bodyText.matchAll(/(?:©|\(c\)|copyright)[^0-9]{0,20}(\d{4})/gi))
        .map((m) => Number(m[1]))
        .filter((y) => y >= 2000 && y <= 2100),
    ),
  );

  const hasEventDates = /\b20(2[5-9]|[3-9]\d)\b/.test(bodyText);
  const hasCountdown =
    /countdown|days?\s+left|hrs?\s+left|hours?\s+left|mins?\s+left/i.test(bodyText) ||
    $("[id*=\"countdown\"], [class*=\"countdown\"]").length > 0;

  return {
    ok: res.status >= 200 && res.status < 400,
    error: null,
    requestedPath: path,
    url: pageUrl,
    finalUrl: res.finalUrl,
    httpStatus: res.status,
    httpVersion: res.httpVersion,
    fetchedAt: new Date().toISOString(),
    ttfbMs: res.ttfbMs,
    totalMs: res.totalMs,
    transferredBytes: res.transferredBytes,
    uncompressedBytes: res.uncompressedBytes,
    encoding: res.encoding,
    domNodes: $("*").length,
    title,
    titleLength: title?.length ?? 0,
    metaDescription: metaDesc,
    descriptionLength: metaDesc?.length ?? 0,
    metaKeywords,
    canonical,
    canonicalCount: canonicals.length,
    canonicalStatus,
    robotsMeta,
    indexable,
    nofollowMeta,
    viewport,
    charset,
    htmlLang,
    metaRefresh,
    openGraph: og,
    twitter,
    jsonLdTypes: Array.from(new Set(jsonLdTypes)),
    jsonLdBlocks,
    jsonLdValid,
    jsonLdError,
    h1,
    h2,
    h3,
    headingSequence,
    wordCount,
    links,
    internalLinksUnique: internalSet.size,
    externalLinksUnique: externalSet.size,
    nofollowLinks: links.filter((l) => l.isNofollow).length,
    unsafeBlankLinks: links.filter((l) => l.unsafeBlank).length,
    internalLinkTargets: Array.from(internalSet),
    images,
    imagesMissingAlt: images.filter((img) => !img.hasAlt || !img.alt).map((img) => img.src || "(no src)"),
    imagesMissingSrcset: images.filter((img) => !img.srcset).map((img) => img.src || "(no src)"),
    imagesMissingDims: images.filter((img) => !img.width || !img.height).map((img) => img.src || "(no src)"),
    favicon,
    deprecatedTags,
    hreflang,
    stylesheets,
    inlineScriptCount,
    syncHeadScripts,
    plaintextEmails: Array.from(emails),
    mixedContent: Array.from(new Set(mixedContent)),
    copyrightYears,
    hasEventDates,
    hasCountdown,
  };
}

function emptyCrawl(path: string, url: string, error: string): CrawlResult {
  return {
    ok: false,
    error,
    requestedPath: path,
    url,
    finalUrl: url,
    httpStatus: 0,
    httpVersion: "unknown",
    fetchedAt: new Date().toISOString(),
    ttfbMs: 0,
    totalMs: 0,
    transferredBytes: 0,
    uncompressedBytes: 0,
    encoding: "identity",
    domNodes: 0,
    title: null,
    titleLength: 0,
    metaDescription: null,
    descriptionLength: 0,
    metaKeywords: null,
    canonical: null,
    canonicalCount: 0,
    canonicalStatus: "missing",
    robotsMeta: null,
    indexable: false,
    nofollowMeta: false,
    viewport: null,
    charset: null,
    htmlLang: null,
    metaRefresh: false,
    openGraph: {},
    twitter: {},
    jsonLdTypes: [],
    jsonLdBlocks: 0,
    jsonLdValid: true,
    jsonLdError: null,
    h1: [],
    h2: [],
    h3: [],
    headingSequence: [],
    wordCount: 0,
    links: [],
    internalLinksUnique: 0,
    externalLinksUnique: 0,
    nofollowLinks: 0,
    unsafeBlankLinks: 0,
    internalLinkTargets: [],
    images: [],
    imagesMissingAlt: [],
    imagesMissingSrcset: [],
    imagesMissingDims: [],
    favicon: false,
    deprecatedTags: [],
    hreflang: [],
    stylesheets: [],
    inlineScriptCount: 0,
    syncHeadScripts: 0,
    plaintextEmails: [],
    mixedContent: [],
    copyrightYears: [],
    hasEventDates: false,
    hasCountdown: false,
  };
}

/** Fetches + parses one live route. Returns an honest error record on failure. */
export async function crawlRoute(origin: string, path: string): Promise<CrawlResult> {
  const url = path === "/" ? `${origin}/` : `${origin}${path.startsWith("/") ? path : `/${path}`}`;
  try {
    const res = await fetchWithTiming(url);
    return parseHtml(path || "/", res);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return emptyCrawl(path || "/", url, message);
  }
}

/** Fetches + parses a batch of routes with limited concurrency. */
export async function crawlRoutes(
  origin: string,
  paths: string[],
  options: { concurrency?: number; delayMs?: number } = {},
): Promise<CrawlResult[]> {
  const concurrency = Math.max(1, options.concurrency ?? 2);
  const delayMs = options.delayMs ?? 250;
  const results: CrawlResult[] = [];
  let index = 0;

  const worker = async () => {
    while (index < paths.length) {
      const current = index;
      index += 1;
      const path = paths[current];
      results.push(await crawlRoute(origin, path));
      if (delayMs > 0) await new Promise((r) => setTimeout(r, delayMs));
    }
  };

  await Promise.all(Array.from({ length: Math.min(concurrency, paths.length) }, worker));
  const order = new Map(paths.map((p, i) => [p, i]));
  results.sort((a, b) => (order.get(a.requestedPath) ?? 0) - (order.get(b.requestedPath) ?? 0));
  return results;
}

/** Reachability check used for internal link verification. */
export async function checkLinkStatus(url: string, timeoutMs = 10_000): Promise<number | null> {
  try {
    const res = await fetchWithTiming(url, { timeoutMs, acceptEncoding: "identity" });
    return res.status;
  } catch {
    return null;
  }
}
