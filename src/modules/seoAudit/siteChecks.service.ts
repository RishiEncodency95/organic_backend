/**
 * Real site-wide checks: robots.txt, sitemap.xml, TLS certificate, HTTP/2,
 * security headers, SPF DNS record, custom 404, canonicalization and ads.txt.
 *
 * Every check performs an actual network / DNS / TLS call at request time.
 */

import * as tls from "tls";
import * as http from "http";
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
  /** Lines that are not valid robots.txt (no "field: value", or an unknown field). Absent on older audits. */
  invalidLines?: string[];
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
  /** Format problems found in the XML. Absent on older audits. */
  problems?: string[];
  bytes?: number;
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
  /** TLS version and cipher the server negotiated, and whether the certificate is for this host. Absent on older audits. */
  protocol?: string | null;
  cipher?: string | null;
  hostMatches?: boolean;
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
    /** Why the www address did not answer (for example ENOTFOUND = no DNS record). Absent on older audits. */
    wwwError?: string | null;
  };
  /** What http://host/ answers, without following it. Absent on older audits. */
  httpRedirect?: { status: number | null; location: string | null; error: string | null };
  /** /llms.txt: whether it exists and what is wrong with its format. Absent on older audits. */
  llmsTxt?: { status: number | null; exists: boolean; problems: string[] };
  /** robots.txt rules of other sites that serve scripts, styles or images to this site's pages, by host. Absent on older audits. */
  externalRobots?: Record<string, RobotsCheck["rules"]>;
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
    const invalidLines: string[] = [];
    const KNOWN = new Set(["user-agent", "allow", "disallow", "sitemap", "crawl-delay", "host", "clean-param", "noindex", "request-rate", "visit-time"]);
    let current: { userAgent: string; allow: string[]; disallow: string[] } | null = null;
    for (const raw of lines) {
      const line = raw.split("#")[0].trim();
      if (!line) continue;
      const idx = line.indexOf(":");
      if (idx === -1 || !KNOWN.has(line.slice(0, idx).trim().toLowerCase())) {
        invalidLines.push(line.slice(0, 80));
        continue;
      }
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
    return { available: true, url, rules, sitemaps, error: null, invalidLines };
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

/** What is wrong with the sitemap XML itself (not with the pages it lists). Empty when it is valid. */
export function sitemapProblems(xml: string, entries: SitemapEntry[]): string[] {
  const problems: string[] = [];
  if (!/<(urlset|sitemapindex)[\s>]/i.test(xml)) problems.push("No <urlset> or <sitemapindex> root element");
  const open = (xml.match(/<url>/gi) || []).length;
  const close = (xml.match(/<\/url>/gi) || []).length;
  if (open !== close) problems.push(`${open} <url> tags but ${close} closing tags`);
  const bad = entries.filter((e) => {
    try {
      const u = new URL(e.loc);
      return u.protocol !== "http:" && u.protocol !== "https:";
    } catch {
      return true;
    }
  });
  if (bad.length > 0) problems.push(`${bad.length} <loc> value(s) are not valid web addresses, e.g. ${bad[0].loc.slice(0, 60)}`);
  const badDate = entries.filter((e) => e.lastmod && Number.isNaN(Date.parse(e.lastmod)));
  if (badDate.length > 0) problems.push(`${badDate.length} <lastmod> value(s) are not valid dates`);
  const dupes = entries.length - new Set(entries.map((e) => e.loc)).size;
  if (dupes > 0) problems.push(`${dupes} URL(s) are listed more than once`);
  return problems;
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
      if (entries.length > 0) return { available: true, url, entries, error: null, problems: sitemapProblems(res.body, entries), bytes: Buffer.byteLength(res.body) };
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
        const hostMismatch = tls.checkServerIdentity(host, cert as unknown as tls.PeerCertificate);
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
          protocol: socket.getProtocol() ?? null,
          cipher: socket.getCipher()?.name ?? null,
          hostMatches: hostMismatch === undefined,
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

const bare = (host: string) => host.toLowerCase().replace(/^www\./, "");

/**
 * Compares the apex and the www address. "www does not answer" is reported as exactly that (with the reason);
 * it is never counted as "redirects to the apex".
 */
export async function checkCanonicalization(host: string): Promise<{ apexStatus: number | null; wwwStatus: number | null; wwwRedirectsToApex: boolean; wwwError: string | null }> {
  const cleanHost = bare(host);
  const apex = `https://${cleanHost}/`;
  const www = `https://www.${cleanHost}/`;
  let apexStatus: number | null = null;
  let wwwStatus: number | null = null;
  let wwwRedirectsToApex = false;
  let wwwError: string | null = null;
  try {
    const res = await fetchWithTiming(apex, { acceptEncoding: "identity" });
    apexStatus = res.status;
  } catch { /* leave null */ }
  try {
    const res = await fetchWithTiming(www, { acceptEncoding: "identity" });
    wwwStatus = res.status;
    // It redirects only when it was really sent on to the apex address.
    wwwRedirectsToApex = res.redirects.length > 0 && bare(new URL(res.finalUrl).hostname) === cleanHost && !new URL(res.finalUrl).hostname.startsWith("www.");
  } catch (err) {
    wwwError = (err as NodeJS.ErrnoException)?.code || (err instanceof Error ? err.message : String(err));
  }
  return { apexStatus, wwwStatus, wwwRedirectsToApex, wwwError };
}

/** Asks http://host/ once and reports the answer without following it, to see how the insecure address is handled. */
export function checkHttpRedirect(host: string, port = 80): Promise<{ status: number | null; location: string | null; error: string | null }> {
  return new Promise((resolve) => {
    const req = http.request(
      { hostname: host, port, path: "/", method: "GET", headers: { "User-Agent": "Mozilla/5.0 (compatible; SeoAudit)", "Accept-Encoding": "identity", Connection: "close" }, timeout: 10_000 },
      (res) => {
        const location = res.headers.location ? String(res.headers.location) : null;
        res.destroy();
        resolve({ status: res.statusCode ?? null, location, error: null });
      },
    );
    req.on("timeout", () => req.destroy(new Error("timeout")));
    req.on("error", (err: NodeJS.ErrnoException) => resolve({ status: null, location: null, error: err.code || err.message }));
    req.end();
  });
}

/** robots.txt rules of other hosts (at most 8), to see whether they block files this site loads from them. */
export async function checkExternalRobots(hosts: string[]): Promise<Record<string, RobotsCheck["rules"]>> {
  const result: Record<string, RobotsCheck["rules"]> = {};
  await Promise.all(
    Array.from(new Set(hosts))
      .slice(0, 8)
      .map(async (host) => {
        const robots = await checkRobotsTxt(`https://${host}`);
        result[host] = robots.available ? robots.rules : [];
      }),
  );
  return result;
}

/** Fetches /llms.txt and checks it against the llms.txt format (a markdown file: H1 title first, then links). */
export async function checkLlmsTxt(origin: string): Promise<{ status: number | null; exists: boolean; problems: string[] }> {
  try {
    const res = await fetchWithTiming(`${origin}/llms.txt`, { acceptEncoding: "identity" });
    if (res.status !== 200) return { status: res.status, exists: false, problems: [] };
    const problems: string[] = [];
    const type = String(res.headers["content-type"] || "");
    if (/text\/html/i.test(type)) problems.push("Served as an HTML page, not as plain text or markdown");
    const lines = res.body.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    if (lines.length === 0) problems.push("The file is empty");
    else if (!/^#\s+\S/.test(lines[0])) problems.push("The first line must be a '# Title' heading");
    if (lines.length > 0 && !/\[[^\]]+\]\((https?:\/\/|\/)[^)]+\)/.test(res.body)) problems.push("No markdown links ([text](url)) to the site's key pages");
    const broken = lines.filter((l) => /^[-*]\s+\[[^\]]*\]\([^)]*$/.test(l) || /^[-*]\s+\[[^\]]*$/.test(l));
    if (broken.length > 0) problems.push(`${broken.length} link line(s) are malformed, e.g. ${broken[0].slice(0, 60)}`);
    return { status: 200, exists: true, problems };
  } catch {
    return { status: null, exists: false, problems: [] };
  }
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
  const [sitemap, tlsCheck, http2Check, headers, spf, notFoundPage, canonicalization, adsTxt, httpRedirect, llmsTxt] = await Promise.all([
    checkSitemap(origin, robotsTxt),
    checkTls(host),
    checkHttp2(origin),
    checkSecurityHeaders(origin),
    checkSpf(host),
    checkCustom404(origin),
    checkCanonicalization(host),
    checkAdsTxt(origin),
    origin.startsWith("https://") ? checkHttpRedirect(host) : Promise.resolve(undefined),
    checkLlmsTxt(origin),
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
    ...(httpRedirect ? { httpRedirect } : {}),
    llmsTxt,
  };
}
