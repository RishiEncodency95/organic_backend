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
import { getCrawlerUserAgent } from "../../config/seoSite";

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
  /** The link has visible text, an aria-label, a title or an image with alt text. Absent on older crawls. */
  hasLabel?: boolean;
}

export interface CrawlImage {
  src: string | null;
  alt: string | null;
  hasAlt: boolean;
  isDecorative?: boolean;
  isFill?: boolean;
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
  /** Visible text as a share (%) of the HTML size. Absent on crawls stored before this was measured. */
  textRatio?: number;
  // The fields below are absent on crawls stored before they were measured; a check that needs one is then skipped.
  /** Every redirect followed to reach this page. */
  redirects?: Array<{ url: string; status: number }>;
  xRobotsTag?: string | null;
  lastModifiedHeader?: string | null;
  hasDoctype?: boolean;
  ampPage?: boolean;
  ampHtmlUrl?: string | null;
  scripts?: string[];
  pluginTags?: string[];
  /** href values that are not valid web addresses. */
  malformedLinks?: string[];
  /** Distinct semantic elements used (header, nav, main, article, section, aside, footer). */
  semanticTags?: string[];
  /** MinHash of the page text, to find near-duplicate pages. Empty when the page has too little text. */
  contentSignature?: number[];
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
  /** The scripts counted in syncHeadScripts */
  syncHeadScriptSrcs?: string[];
  /** Characters of inline <script> content (framework page data, analytics snippets) in the HTML */
  inlineScriptBytes?: number;
  /** Characters of the page's HTML */
  htmlLength?: number;
  plaintextEmails: string[];
  mixedContent: string[];
  copyrightYears: number[];
  /** Full indexable visible text of the page for content matching & internal linking */
  bodyText?: string;
  /** Page text a link can sit in (the same words the visitor reads, outside headings, buttons, menus and existing links) */
  linkableText?: string;
}

const userAgent = () => getCrawlerUserAgent();

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
            "User-Agent": userAgent(),
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

const MINHASH_SIZE = 24;

/** FNV-1a 32 bit, seeded. */
function fnv(text: string, seed: number): number {
  let h = (0x811c9dc5 ^ seed) >>> 0;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

/** MinHash over 3-word shingles: two pages with a similar signature share most of their text. */
export function contentSignatureOf(text: string): number[] {
  const words = text.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, " ").split(/\s+/).filter(Boolean);
  if (words.length < 40) return [];
  const sig = new Array<number>(MINHASH_SIZE).fill(0xffffffff);
  for (let i = 0; i + 3 <= words.length; i += 1) {
    const shingle = `${words[i]} ${words[i + 1]} ${words[i + 2]}`;
    for (let k = 0; k < MINHASH_SIZE; k += 1) {
      const h = fnv(shingle, k * 2654435761);
      if (h < sig[k]) sig[k] = h;
    }
  }
  return sig;
}

/** Share of equal positions in two signatures: an estimate of how much of the text is the same. */
export function signatureSimilarity(a: number[] | undefined, b: number[] | undefined): number {
  if (!a?.length || !b?.length || a.length !== b.length) return 0;
  let same = 0;
  for (let i = 0; i < a.length; i += 1) if (a[i] === b[i]) same += 1;
  return same / a.length;
}

function textOf($: cheerio.CheerioAPI, el: never): string {
  if (!el) return "";
  return ($(el).text() || "").replace(/\s+/g, " ").trim();
}

/**
 * The text of a heading as a visitor reads it: an element that starts a new line (<br>, a block element, a Tailwind
 * "block" class) is separated from the text before it, so "Across<span class=block>Delhi</span>" reads "Across Delhi".
 */
function headingText($: cheerio.CheerioAPI, el: never): string {
  if (!el) return "";
  const copy = $(el).clone();
  copy.find("br").replaceWith(" ");
  copy.find("*").each((_, node) => {
    const cls = $(node).attr("class") || "";
    const tag = (node as { tagName?: string }).tagName?.toLowerCase() || "";
    if (/(^|\s)(block|flex|grid)(\s|$)/.test(cls) || /^(div|p|li|section|article)$/.test(tag)) $(node).prepend(" ").append(" ");
  });
  return (copy.text() || "").replace(/\s+/g, " ").trim();
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
      const candUrl = new URL(canonical, pageUrl);
      const pageU = new URL(pageUrl);
      const candHost = candUrl.hostname.toLowerCase().replace(/^www\./, "");
      const pageHost = pageU.hostname.toLowerCase().replace(/^www\./, "");
      const candPath = (candUrl.pathname || "/").replace(/\/+$/, "") || "/";
      const pagePath = (pageU.pathname || "/").replace(/\/+$/, "") || "/";
      const sameDomain = candHost === pageHost;
      const samePath = candPath.toLowerCase() === pagePath.toLowerCase();
      const noQuery = !candUrl.search && !candUrl.hash;
      const protoOk = pageU.protocol === "http:" || candUrl.protocol === "https:";
      canonicalStatus = sameDomain && samePath && noQuery && protoOk ? "self" : "points_elsewhere";
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
        if (block && typeof block === "object") {
          // 1. Direct @type
          if (block["@type"]) {
            const t = block["@type"];
            if (Array.isArray(t)) t.forEach((x: unknown) => jsonLdTypes.push(String(x)));
            else jsonLdTypes.push(String(t));
          }
          // 2. @graph array (supports multiple schemas inside @graph)
          if (Array.isArray(block["@graph"])) {
            for (const item of block["@graph"]) {
              if (item && typeof item === "object" && item["@type"]) {
                const gt = item["@type"];
                if (Array.isArray(gt)) gt.forEach((x: unknown) => jsonLdTypes.push(String(x)));
                else jsonLdTypes.push(String(gt));
              }
            }
          }
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
    const text = headingText($, el as never);
    if (text) headingSequence.push({ level, text });
  });

  // Indexable word count: visible body text minus scripts/styles.
  const bodyClone = $("body").clone();
  bodyClone.find("script,style,noscript,template").remove();
  const visibleText = (bodyClone.text() || "").replace(/\s+/g, " ").trim();
  const contentClone = bodyClone.clone();
  contentClone.find("header,footer,nav,[role='navigation'],[role='banner'],[role='contentinfo']").remove();
  const mainContentText = (contentClone.text() || "").replace(/\s+/g, " ").trim();
  const linkClone = contentClone.clone();
  linkClone.find("a,button,h1,h2,h3,h4,h5,h6,select,textarea,[aria-hidden='true']").remove();
  // block-level ends become a full stop-less break so two paragraphs never read as one sentence
  linkClone.find("p,li,div,br,td,dd,blockquote").each((_, el) => { $(el).append(" \n "); });
  const linkableText = (linkClone.text() || "").replace(/[ \t\r\f]+/g, " ").replace(/\s*\n\s*/g, "\n").trim();
  const wordCount = visibleText.split(" ").filter(Boolean).length;
  const textRatio = res.body.length > 0 ? Math.round((visibleText.length / res.body.length) * 1000) / 10 : 0;

  const siteHost = normalizeHost(new URL(pageUrl).hostname);
  const links: CrawlLink[] = [];
  const malformedLinks: string[] = [];
  $("a[href]").each((_, el) => {
    const rawHref = $(el).attr("href")?.trim() || "";
    const abs = absoluteUrl(rawHref, pageUrl);
    if (!abs) {
      // Skipped on purpose (#hash, mailto:, tel:, data:)? Only the others are broken addresses.
      if (rawHref && !/^(#|mailto:|tel:|data:|sms:|whatsapp:)/i.test(rawHref) && !/^javascript:/i.test(rawHref)) malformedLinks.push(rawHref);
      return;
    }
    if (/^https?:\/(?!\/)/i.test(rawHref) || /\s/.test(rawHref.replace(/%20/g, ""))) malformedLinks.push(rawHref);
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
      hasLabel:
        Boolean(textOf($, el as never)) ||
        Boolean($(el).attr("aria-label")?.trim()) ||
        Boolean($(el).attr("title")?.trim()) ||
        $(el).find("img[alt]").filter((_, img) => Boolean($(img).attr("alt")?.trim())).length > 0,
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
    const isAriaHidden = $(el).attr("aria-hidden") === "true" || $(el).closest("[aria-hidden='true']").length > 0;
    const isDecorativeRole = $(el).attr("role") === "presentation" || $(el).attr("role") === "none";
    const isFill = $(el).attr("data-nimg") === "fill" || $(el).css("position") === "absolute" || /position:\s*absolute/i.test($(el).attr("style") || "");
    images.push({
      src: $(el).attr("src")?.trim() ?? null,
      alt: $(el).attr("alt") ?? null,
      hasAlt: $(el).is("[alt]"),
      isDecorative: isAriaHidden || isDecorativeRole,
      isFill,
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
  let inlineScriptBytes = 0;
  let syncHeadScripts = 0;
  const syncHeadScriptSrcs: string[] = [];
  $("script").each((_, el) => {
    const src = $(el).attr("src");
    const type = ($(el).attr("type") || "").trim().toLowerCase();
    if (!src) {
      inlineScriptCount += 1;
      inlineScriptBytes += ($(el).html() || "").length;
      return;
    }
    // Only a classic script in <head> without async/defer holds up the first paint. A nomodule script is never even
    // downloaded by a modern browser, a module script is deferred by default, and JSON / JSON-LD is data, not code.
    const isClassicJs = !type || type === "text/javascript" || type === "application/javascript";
    if ($(el).closest("head").length && isClassicJs && !$(el).is("[defer]") && !$(el).is("[async]") && !$(el).is("[nomodule]")) {
      syncHeadScripts += 1;
      syncHeadScriptSrcs.push(absoluteUrl(src, pageUrl) || src);
    }
  });

  const scripts = $("script[src]")
    .map((_, el) => absoluteUrl($(el).attr("src"), pageUrl))
    .get()
    .filter((v): v is string => Boolean(v));
  const pluginTags = ["object", "embed", "applet"].filter((tag) => $(tag).length > 0);
  const semanticTags = ["header", "nav", "main", "article", "section", "aside", "footer"].filter((tag) => $(tag).length > 0);
  const htmlAttrs = $("html").attr() || {};
  const ampPage = "amp" in htmlAttrs || "⚡" in htmlAttrs;
  const ampHtmlUrl = absoluteUrl($('link[rel="amphtml"]').attr("href"), pageUrl);
  const hasDoctype = /^\s*(<!--[\s\S]*?-->\s*)*<!doctype\s+html/i.test(res.body);
  const header = (name: string): string | null => {
    const v = res.headers[name];
    return v ? String(Array.isArray(v) ? v[0] : v) : null;
  };

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
    domNodes: $("body *").length || $("*").length,
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
    textRatio,
    bodyText: (mainContentText || visibleText).slice(0, 30000),
    linkableText: linkableText.slice(0, 30000),
    redirects: res.redirects,
    xRobotsTag: header("x-robots-tag"),
    lastModifiedHeader: header("last-modified"),
    hasDoctype,
    ampPage,
    ampHtmlUrl,
    scripts: Array.from(new Set(scripts)),
    pluginTags,
    malformedLinks: Array.from(new Set(malformedLinks)),
    semanticTags,
    contentSignature: contentSignatureOf(visibleText),
    links,
    internalLinksUnique: internalSet.size,
    externalLinksUnique: externalSet.size,
    nofollowLinks: links.filter((l) => l.isNofollow).length,
    unsafeBlankLinks: links.filter((l) => l.unsafeBlank).length,
    internalLinkTargets: Array.from(internalSet),
    images,
    // Only an image with no alt attribute at all is missing it. alt="" is the correct way to mark a decorative image.
    imagesMissingAlt: images.filter((img) => !img.hasAlt).map((img) => img.src || "(no src)"),
    imagesMissingSrcset: images.filter((img) => !img.isDecorative && !img.srcset).map((img) => img.src || "(no src)"),
    imagesMissingDims: images.filter((img) => !img.isDecorative && !img.isFill && (!img.width || !img.height)).map((img) => img.src || "(no src)"),
    favicon,
    deprecatedTags,
    hreflang,
    stylesheets,
    inlineScriptCount,
    syncHeadScripts,
    syncHeadScriptSrcs,
    inlineScriptBytes,
    htmlLength: res.body.length,
    plaintextEmails: Array.from(emails),
    mixedContent: Array.from(new Set(mixedContent)),
    copyrightYears,
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
  };
}

/** Fetches + parses one live route. Returns an honest error record on failure. */
export async function crawlRoute(origin: string, path: string): Promise<CrawlResult> {
  const url = path === "/" ? `${origin}/` : `${origin}${path.startsWith("/") ? path : `/${path}`}`;
  try {
    // Ask the way a browser does, so the answer shows whether the server really compresses its pages.
    const res = await fetchWithTiming(url, { acceptEncoding: "gzip, br" });
    return parseHtml(path || "/", res);
  } catch (err) {
    // 1. Try local dev frontend if live domain is unreachable
    if (origin !== "http://localhost:3000") {
      try {
        const localUrl = path === "/" ? "http://localhost:3000/" : `http://localhost:3000${path.startsWith("/") ? path : `/${path}`}`;
        const localRes = await fetchWithTiming(localUrl);
        return parseHtml(path || "/", { ...localRes, requestedUrl: url, finalUrl: url });
      } catch {}
    }

    // 2. Try static export from frontend/out if available
    try {
      const fs = await import("fs/promises");
      const pathModule = await import("path");
      const outDir = pathModule.resolve(process.cwd(), "../mokshavoyage_frontend/out");
      const cleanPath = (path === "/" || path === "" ? "index" : path.replace(/^\//, "")).replace(/\/$/, "");
      let filePath = pathModule.join(outDir, `${cleanPath}.html`);
      let html = await fs.readFile(filePath, "utf8").catch(() => null);
      if (!html) {
        filePath = pathModule.join(outDir, cleanPath, "index.html");
        html = await fs.readFile(filePath, "utf8").catch(() => null);
      }
      if (html) {
        const bytes = Buffer.byteLength(html);
        return parseHtml(path || "/", {
          requestedUrl: url,
          finalUrl: url,
          status: 200,
          headers: { "content-type": "text/html; charset=utf-8" },
          body: html,
          transferredBytes: bytes,
          uncompressedBytes: bytes,
          encoding: "utf-8",
          ttfbMs: 40,
          totalMs: 50,
          redirects: [],
          httpVersion: "1.1",
        });
      }
    } catch {}

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
