import { isIP } from "node:net";
export interface NormalizedSite {
  url: string;
  domain: string;
}

const MAX_URL_LENGTH = 2048;

export function normalizeSite(input: unknown): NormalizedSite | null {
  if (typeof input !== "string") return null;
  const raw = input.trim();
  if (!raw || raw.length > 300 || /\s/.test(raw)) return null;
  let u: URL;
  try {
    u = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(raw) ? raw : `https://${raw}`);
  } catch {
    return null;
  }
  if (!/^https?:$/.test(u.protocol) || u.username || u.password) return null;
  const host = u.hostname.toLowerCase().replace(/\.$/, "");
  if (!host.includes(".") || isIP(host.replace(/^\[|\]$/g, "")) || host === "localhost" || /\.(local|localhost|internal|lan|home|corp)$/.test(host)) return null;
  if (!/^[a-z0-9.-]+$/.test(host) || host.split(".").some((label) => !label || label.length > 63)) return null;
  const port = u.port && !((u.protocol === "https:" && u.port === "443") || (u.protocol === "http:" && u.port === "80")) ? `:${u.port}` : "";
  return { url: `${u.protocol}//${host}${port}/`, domain: domainOf(host) };
}

export function domainOf(hostOrUrl: string): string {
  let host = hostOrUrl;
  try {
    if (/^https?:\/\//i.test(hostOrUrl)) host = new URL(hostOrUrl).hostname;
  } catch {
    /* keep as-is */
  }
  return host.toLowerCase().replace(/\.$/, "").replace(/^www\./, "");
}

export function sameSite(a: string, b: string): boolean {
  return domainOf(a) === domainOf(b);
}

export function normalizePageUrl(raw: string, base?: string | URL): string | null {
  let u: URL;
  try {
    u = base ? new URL(raw, base) : new URL(raw);
  } catch {
    return null;
  }
  if (!/^https?:$/.test(u.protocol) || u.username || u.password) return null;
  if (u.href.length > MAX_URL_LENGTH) return null;
  u.hash = "";
  u.hostname = u.hostname.toLowerCase();
  for (const key of [...u.searchParams.keys()]) {
    if (/^(utm_|fbclid$|gclid$|mc_|ref$|_ga$)/i.test(key)) u.searchParams.delete(key);
  }
  let href = u.href;
  if (u.pathname !== "/" && href.endsWith("/") && !u.search) href = href.slice(0, -1);
  return href;
}

export function isSkippablePath(pathname: string): boolean {
  return (
    /\.(pdf|jpe?g|png|gif|webp|svg|ico|mp4|mp3|webm|zip|rar|docx?|xlsx?|pptx?|css|js|json|xml|txt|woff2?|ttf)$/i.test(pathname) ||
    /\/(wp-admin|wp-login|login|signin|sign-in|logout|register|signup|sign-up|account|my-account|cart|checkout|basket|admin|dashboard|feed|wp-json|cdn-cgi)(\/|$)/i.test(pathname)
  );
}
