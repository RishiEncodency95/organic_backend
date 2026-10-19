/**
 * Real site-wide checks: robots.txt, sitemap.xml, TLS certificate, HTTP/2,
 * security headers, SPF DNS record, custom 404, canonicalization and ads.txt.
 *
 * Every check performs an actual network / DNS / TLS call at request time.
 */

import * as tls from "tls";
import * as http2 from "http2";
import * as dns from "dns";
import { promises as dnsPromises } from "dns";
import { URL } from "url";
import { fetchWithTiming } from "./crawler.service";

export interface RobotsCheck {
  available: boolean;
  url: string | null;
  rules: Array<{ userAgent: string; allow: string[]; disallow: string[] }>;
  sitemaps: string[];
  error: string | null;
}

export interface SitemapEntry {
  loc: string;
  lastmod: string | null;
  changefreq: string | null;
  priority: string | null;
}

export interface SitemapCheck {
  available: boolean;
  url: string | null;
  entries: SitemapEntry[];
  error: string | null;
}

export interface TlsCheck {
  available: boolean;
  subject: string | null;
  issuer: string | null;
  validFrom: string | null;
  validTo: string | null;
  daysRemaining: number | null;
  serialNumber: string | null;
  sigalg: string | null;
  san: string | null;
  fingerprint256: string | null;
  trusted: boolean;
  error: string | null;
}

export interface SecurityHeadersCheck {
  server: string | null;
  hsts: string | null;
  contentTypeOptions: string | null;
  frameOptions: string | null;
  referrerPolicy: string | null;
  poweredBy: string | null;
  cdnIndicators: string[];
}

export interface SiteChecks {
  fetchedAt: string;
  origin: string;
  robotsTxt: RobotsCheck;
  sitemap: SitemapCheck;
  tls: TlsCheck;
  http2: { available: boolean; error: string | null };
  headers: SecurityHeadersCheck;
  spf: { available: boolean; records: string[]; error: string | null };
  notFoundPage: { status: number | null; isCustom404: boolean };
  canonicalization: {
    apexStatus: number | null;
    wwwStatus: number | null;
    wwwRedirectsToApex: boolean;
  };
  adsTxt: { status: number | null; exists: boolean };
}

/** Fetches and parses robots.txt exactly as a search engine would. */
export async function checkRobotsTxt(origin: string): Promise<RobotsCheck> {
  const url = `${origin}/robots.txt`;
  try {
    const res = await fetchWithTiming(url, { acceptEncoding: "identity" });
    if (res.status !== 200) {
      return { available: false, url: null, rules: [], sitemaps: [], error: `robots.txt responded ${res.status}` };
    }
    const lines = res.body.split(/\r?\n/);
    const rules: RobotsCheck["rules"] = [];
    const sitemaps: string[] = [];
    let current: { userAgent: string; allow: string[]; disallow: string[] } | null = null;
    for (const raw of lines) {
      const line = raw.split("#")[0].trim();
      if (!line) continue;
      const idx = line.indexOf(":");
      if (idx === -1) continue;
      const key = line.slice(0, idx).trim().toLowerCase();
      const value = line.slice(idx + 1).trim();
      if (key === "user-agent") {
        current = { userAgent: value, allow: [], disallow: [] };
        rules.push(current);
      } else if (key === "allow" && current) {
        current.allow.push(value);
      } else if (key === "disallow" && current) {
        current.disallow.push(value);
      } else if (key === "sitemap") {
        sitemaps.push(value);
      }
    }
    return { available: true, url, rules, sitemaps, error: null };
  } catch (err) {
    return {
      available: false,
      url: null,
      rules: [],
      sitemaps: [],
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

interface ParsedSitemap {
  entries: SitemapEntry[];
  childSitemaps: string[];
}

function parseSitemapXml(xml: string): ParsedSitemap {
  const entries: SitemapEntry[] = [];
  const urlBlocks = xml.match(/<url>[\s\S]*?<\/url>/gi) || [];
  for (const block of urlBlocks) {
    const pick = (tag: string): string | null => {
      const m = block.match(new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`, "i"));
      return m ? m[1].trim() : null;
    };
    const loc = pick("loc");
    if (loc) {
      entries.push({
        loc,
        lastmod: pick("lastmod"),
        changefreq: pick("changefreq"),
        priority: pick("priority"),
      });
    }
  }
  // Sitemap index support: collect referenced child sitemaps.
  const sitemapBlocks = xml.match(/<sitemap>[\s\S]*?<\/sitemap>/gi) || [];
  const childSitemaps = sitemapBlocks
    .map((b) => {
      const m = b.match(/<loc>([\s\S]*?)<\/loc>/i);
      return m ? m[1].trim() : null;
    })
    .filter((v): v is string => Boolean(v));
  return { entries, childSitemaps };
}

/** Fetches the XML sitemap (following the robots.txt pointer when present). */
export async function checkSitemap(origin: string, robots?: RobotsCheck): Promise<SitemapCheck> {
  const candidates = [
    ...(robots?.sitemaps ?? []),
    `${origin}/sitemap.xml`,
  ];
  for (const url of Array.from(new Set(candidates))) {
    try {
      const res = await fetchWithTiming(url, { acceptEncoding: "identity" });
      if (res.status !== 200) continue;
      const parsed = parseSitemapXml(res.body);
      let entries = parsed.entries;
      // One level of sitemap-index recursion.
      for (const child of parsed.childSitemaps.slice(0, 5)) {
        try {
          const childRes = await fetchWithTiming(child, { acceptEncoding: "identity" });
          if (childRes.status === 200) {
            entries = entries.concat(parseSitemapXml(childRes.body).entries);
          }
        } catch { /* skip unreachable child sitemap */ }
      }
      if (entries.length > 0) return { available: true, url, entries, error: null };
    } catch { /* try next candidate */ }
  }
  return { available: false, url: null, entries: [], error: "No reachable sitemap.xml found" };
}

/** Opens a real TLS connection and reads the served certificate chain. */
export function checkTls(host: string, port = 443, timeoutMs = 10_000): Promise<TlsCheck> {
  return new Promise((resolve) => {
    const socket = tls.connect(
      { host, port, servername: host, rejectUnauthorized: false, timeout: timeoutMs },
      () => {
        const cert = socket.getPeerCertificate(true) as unknown as Record<string, any>;
        const authorized = (socket as tls.TLSSocket & { authorized?: boolean }).authorized === true;
        const validTo = cert?.valid_to || null;
        const daysRemaining = validTo
          ? Math.round((new Date(validTo).getTime() - Date.now()) / 86_400_000)
          : null;
        socket.end();
        resolve({
          available: true,
          subject: cert?.subject?.CN ?? null,
          issuer: cert?.issuer ? Object.entries(cert.issuer).map(([k, v]) => `${k}=${v}`).join(", ") : null,
          validFrom: cert?.valid_from ?? null,
          validTo,
          daysRemaining,
          serialNumber: cert?.serialNumber ?? null,
          sigalg: cert?.signatureAlgorithm ?? null,
          san: cert?.subjectaltname ?? null,
          fingerprint256: cert?.fingerprint256 ?? null,
          trusted: authorized,
          error: authorized ? null : String((socket as tls.TLSSocket & { authorizationError?: Error }).authorizationError ?? "untrusted"),
        });
      },
    );
    socket.on("error", (err) => {
      resolve({
        available: false,
        subject: null, issuer: null, validFrom: null, validTo: null,
        daysRemaining: null, serialNumber: null, sigalg: null, san: null,
        fingerprint256: null, trusted: false,
        error: err.message,
      });
    });
    socket.on("timeout", () => {
      socket.destroy();
      resolve({
        available: false,
        subject: null, issuer: null, validFrom: null, validTo: null,
        daysRemaining: null, serialNumber: null, sigalg: null, san: null,
        fingerprint256: null, trusted: false,
        error: `TLS connection timed out after ${timeoutMs}ms`,
      });
    });
  });
}

/** Tests whether the origin negotiates an HTTP/2 connection. */
export function checkHttp2(origin: string, timeoutMs = 10_000): Promise<{ available: boolean; error: string | null }> {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (result: { available: boolean; error: string | null }) => {
      if (settled) return;
      settled = true;
      resolve(result);
    };
    try {
      const client = http2.connect(origin, { timeout: timeoutMs });
      client.once("connect", () => { client.close(); finish({ available: true, error: null }); });
      client.once("error", (err) => finish({ available: false, error: err.message }));
      setTimeout(() => { try { client.close(); } catch { /* ignore */ } finish({ available: false, error: "HTTP/2 probe timed out" }); }, timeoutMs);
    } catch (err) {
      finish({ available: false, error: err instanceof Error ? err.message : String(err) });
    }
  });
}

/** Reads real response headers from the live origin. */
export async function checkSecurityHeaders(origin: string): Promise<SecurityHeadersCheck> {
  const empty: SecurityHeadersCheck = {
    server: null, hsts: null, contentTypeOptions: null,
    frameOptions: null, referrerPolicy: null, poweredBy: null, cdnIndicators: [],
  };
  try {
    const res = await fetchWithTiming(`${origin}/`, { acceptEncoding: "identity" });
    const h = res.headers;
    const cdnIndicators: string[] = [];
    if (h["cf-ray"]) cdnIndicators.push(`Cloudflare (cf-ray: ${h["cf-ray"]})`);
    if (h["x-amz-cf-id"]) cdnIndicators.push("AWS CloudFront");
    if (h["x-vercel-id"]) cdnIndicators.push("Vercel");
    if (h["x-fastly-request-id"]) cdnIndicators.push("Fastly");
    if (h["x-azure-ref"]) cdnIndicators.push("Azure CDN");
    if (h["server"] && /cloudflare/i.test(String(h["server"]))) cdnIndicators.push("Cloudflare (server header)");
    return {
      server: h["server"] ? String(h["server"]) : null,
      hsts: h["strict-transport-security"] ? String(h["strict-transport-security"]) : null,
      contentTypeOptions: h["x-content-type-options"] ? String(h["x-content-type-options"]) : null,
      frameOptions: h["x-frame-options"] ? String(h["x-frame-options"]) : null,
      referrerPolicy: h["referrer-policy"] ? String(h["referrer-policy"]) : null,
      poweredBy: h["x-powered-by"] ? String(h["x-powered-by"]) : null,
      cdnIndicators,
    };
  } catch {
    return empty;
  }
}

/** Resolves the real SPF record from DNS. */
export async function checkSpf(host: string): Promise<{ available: boolean; records: string[]; error: string | null }> {
  try {
    const records = await dnsPromises.resolveTxt(host);
    const spf = records
      .map((chunks) => chunks.join(""))
      .filter((record) => record.toLowerCase().startsWith("v=spf1"));
    return { available: spf.length > 0, records: spf, error: spf.length > 0 ? null : "No v=spf1 TXT record found" };
  } catch (err) {
    return {
      available: false,
      records: [],
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/** Requests a nonsense URL to confirm a real custom 404 is served. */
export async function checkCustom404(origin: string): Promise<{ status: number | null; isCustom404: boolean }> {
  const probe = `${origin}/definitely-not-a-real-page-${Date.now().toString(36)}`;
  try {
    const res = await fetchWithTiming(probe, { acceptEncoding: "identity" });
    const looksCustom =
      res.status === 404 &&
      res.body.length > 500 &&
      !/404|not found/i.test(res.body.slice(0, 200)) === false; // 404 page should acknowledge the miss
    const generic = /<title>404|nginx\/|Apache\d|Tomcat/i.test(res.body.slice(0, 500));
    return { status: res.status, isCustom404: res.status === 404 && looksCustom && !generic };
  } catch {
    return { status: null, isCustom404: false };
  }
}

/** Compares apex and www responses for canonicalization behaviour. */
export async function checkCanonicalization(host: string): Promise<{ apexStatus: number | null; wwwStatus: number | null; wwwRedirectsToApex: boolean }> {
  const apex = `https://${host}/`;
  const www = `https://www.${host}/`;
  let apexStatus: number | null = null;
  let wwwStatus: number | null = null;
  let wwwRedirectsToApex = false;
  try {
    const res = await fetchWithTiming(apex, { acceptEncoding: "identity" });
    apexStatus = res.status;
  } catch { /* leave null */ }
  try {
    const res = await fetchWithTiming(www, { acceptEncoding: "identity" });
    wwwStatus = res.status;
    wwwRedirectsToApex = res.finalUrl.replace(/\/$/, "") === apex.replace(/\/$/, "") || res.redirects.some((r) => r.url.startsWith(www));
  } catch { /* leave null */ }
  return { apexStatus, wwwStatus, wwwRedirectsToApex };
}

/** Checks for a served ads.txt (absent is correct when no ad inventory is sold). */
export async function checkAdsTxt(origin: string): Promise<{ status: number | null; exists: boolean }> {
  try {
    const res = await fetchWithTiming(`${origin}/ads.txt`, { acceptEncoding: "identity" });
    return { status: res.status, exists: res.status === 200 };
  } catch {
    return { status: null, exists: false };
  }
}

/** Runs the complete site-wide real check battery for one origin. */
export async function runSiteChecks(origin: string): Promise<SiteChecks> {
  const host = new URL(origin).hostname;
  const robotsTxt = await checkRobotsTxt(origin);
  const [sitemap, tlsCheck, http2Check, headers, spf, notFoundPage, canonicalization, adsTxt] = await Promise.all([
    checkSitemap(origin, robotsTxt),
    checkTls(host),
    checkHttp2(origin),
    checkSecurityHeaders(origin),
    checkSpf(host),
    checkCustom404(origin),
    checkCanonicalization(host),
    checkAdsTxt(origin),
  ]);
  return {
    fetchedAt: new Date().toISOString(),
    origin,
    robotsTxt,
    sitemap,
    tls: tlsCheck,
    http2: http2Check,
    headers,
    spf,
    notFoundPage,
    canonicalization,
    adsTxt,
  };
}
