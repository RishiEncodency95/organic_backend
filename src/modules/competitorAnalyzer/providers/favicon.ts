import * as cheerio from "cheerio";
import { makeSafeFetcher, type Fetcher } from "../crawler/safeFetch";
import { normalizePageUrl, normalizeSite, sameSite } from "../crawler/url";
import { AnalyzerError } from "../errors";

export interface SiteIcon { bytes: Buffer; contentType: string }
const cache = new Map<string, { expiresAt: number; value: Promise<SiteIcon | null> }>();
export const clearFaviconCache = () => cache.clear();
export function faviconCandidates(html: string, base: string): string[] {
  const $ = cheerio.load(html);
  return [...new Set($('link[rel]').toArray().flatMap((el) => {
    const rel = ($(el).attr("rel") ?? "").toLowerCase();
    if (!/(^|\s)(icon|apple-touch-icon|apple-touch-icon-precomposed)(\s|$)/.test(rel)) return [];
    const url = normalizePageUrl($(el).attr("href") ?? "", base);
    return url ? [url] : [];
  }))].slice(0, 5);
}
export function iconType(bytes: Buffer): string | null {
  if (bytes.length < 4) return null;
  if (bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return "image/png";
  if (bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) return "image/jpeg";
  if (bytes.subarray(0, 4).equals(Buffer.from([0, 0, 1, 0]))) return "image/x-icon";
  if (/^GIF8[79]a/.test(bytes.subarray(0, 6).toString("ascii"))) return "image/gif";
  if (bytes.subarray(0, 4).toString() === "RIFF" && bytes.subarray(8, 12).toString() === "WEBP") return "image/webp";
  if (/^\s*(?:<\?xml[^>]*>\s*)?(?:<!--[\s\S]*?-->\s*)*<svg[\s>]/i.test(bytes.toString("utf8"))) return "image/svg+xml";
  return null;
}
export function sanitizeSvg(bytes: Buffer): Buffer {
  const $ = cheerio.load(bytes.toString("utf8"), { xmlMode: true });
  const tags = new Set(["svg", "g", "path", "circle", "rect", "line", "ellipse", "polygon", "polyline", "defs", "symbol", "use", "lineargradient", "radialgradient", "stop", "clippath", "mask", "title", "desc"]);
  const attrs = new Set(["xmlns", "xmlns:xlink", "viewbox", "width", "height", "x", "y", "x1", "x2", "y1", "y2", "cx", "cy", "r", "rx", "ry", "d", "points", "fill", "fill-rule", "fill-opacity", "stroke", "stroke-width", "stroke-linecap", "stroke-linejoin", "stroke-opacity", "opacity", "transform", "id", "href", "xlink:href", "offset", "stop-color", "stop-opacity", "gradientunits", "gradienttransform", "clip-path", "mask"]);
  $("*").each((_, el) => {
    if (!("attribs" in el) || !tags.has(el.name.toLowerCase())) { $(el).remove(); return; }
    for (const [name, value] of Object.entries(el.attribs ?? {})) {
      const namespace = (name === "xmlns" && value === "http://www.w3.org/2000/svg") || (name === "xmlns:xlink" && value === "http://www.w3.org/1999/xlink");
      if (!namespace && (!attrs.has(name.toLowerCase()) || (/href$/i.test(name) && !value.startsWith("#")) || /(?:javascript:|data:|https?:|\/\/)/i.test(value) || /url\(\s*['"]?(?!#)/i.test(value))) $(el).removeAttr(name);
    }
  });
  return Buffer.from($.xml(), "utf8");
}
/** No third-party icon service: the existing DNS-pinned fetcher checks every destination and redirect. */
export async function faviconForWebsite(input: string, fetcher: Fetcher = makeSafeFetcher()): Promise<SiteIcon> {
  const site = normalizeSite(input);
  if (!site) throw new AnalyzerError(404, "RUN_NOT_FOUND", "Website icon is unavailable");
  let entry = cache.get(site.url);
  if (!entry || entry.expiresAt <= Date.now()) {
    if (cache.size >= 128) cache.delete(cache.keys().next().value!);
    const value = (async (): Promise<SiteIcon | null> => {
      const options = { timeoutMs: 4_000, maxBytes: 256_000, signal: AbortSignal.timeout(12_000) };
      let candidates: string[] = [];
      try {
        const home = await fetcher(site.url, options);
        if (home.ok && sameSite(new URL(home.url).hostname, site.domain)) candidates = faviconCandidates(home.body, home.url);
      } catch { /* fallback to the conventional icon below */ }
      for (const url of [...new Set([...candidates, new URL("/favicon.ico", site.url).href])].slice(0, 6)) {
        try {
          const response = await fetcher(url, { ...options, responseType: "binary", headers: { accept: "image/*" } });
          if (!response.ok || response.truncated || !response.bodyBytes) continue;
          const contentType = iconType(response.bodyBytes);
          if (contentType) return { bytes: contentType === "image/svg+xml" ? sanitizeSvg(response.bodyBytes) : response.bodyBytes, contentType };
        } catch { /* skip an unavailable or unsafe icon target */ }
      }
      return null;
    })();
    entry = { value, expiresAt: Date.now() + 6 * 60 * 60_000 };
    cache.set(site.url, entry);
    void value.then((icon) => { if (!icon && cache.get(site.url)?.value === value) cache.set(site.url, { value, expiresAt: Date.now() + 10 * 60_000 }); });
  }
  const icon = await entry.value;
  if (!icon) throw new AnalyzerError(404, "RUN_NOT_FOUND", "Website icon is unavailable");
  return icon;
}
