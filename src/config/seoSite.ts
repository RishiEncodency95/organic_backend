/**
 * Which website the SEO audit is about. Everything that names the site (domain, brand, the questions
 * asked to AI assistants) is read from here, so nothing about another project is baked into the audit
 * engine. All of it can be changed from the environment without touching code:
 *
 *   SEO_AUDIT_ORIGIN   site to audit, e.g. https://mokshavoyage.in   (falls back to LIVE_SITE_URL, then NEXT_PUBLIC_SITE_URL)
 *   SEO_SITE_NAME      brand name shown in reports                    (default "Moksha Voyage")
 *   SEO_SITE_DESCRIPTION  one line on what the business does and where, used in AI prompts
 *   SEO_BRAND_TERMS    comma separated words that count as a brand mention in AI answers
 *   SEO_LLM_QUERIES    questions asked to AI assistants, separated by "|"
 *
 * Read lazily (functions, not constants) so a changed environment, or a test, takes effect at once.
 */

const FALLBACK_ORIGIN = "https://bharatorganicexpo.com";
const FALLBACK_NAME = "Bharat Organic Expo";
const FALLBACK_DESCRIPTION =
  "India's premier B2B and B2C organic food, natural products, sustainable agriculture, and wellness exhibition";

const FALLBACK_LLM_QUERIES = [
  "Best organic food expo in India",
  "Bharat Organic Expo Delhi NCR",
  "Organic agriculture trade fair India",
  "B2B organic products exhibition India",
  "Organic food and wellness expo exhibitors India",
  "Bharat Organic Expo reviews",
];

const list = (value: string | undefined, separator: string): string[] =>
  (value ?? "")
    .split(separator)
    .map((item) => item.trim())
    .filter(Boolean);

/** "https://www.example.com/path?x=1" -> "https://www.example.com". Returns null when it is not a URL. */
export function toOrigin(value: string | undefined | null): string | null {
  if (!value) return null;
  try {
    const url = new URL(value.trim());
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return `${url.protocol}//${url.host}`;
  } catch {
    return null;
  }
}

/** The site every audit runs against. */
export function getSiteOrigin(): string {
  return (
    toOrigin(process.env.SEO_AUDIT_ORIGIN) ||
    toOrigin(process.env.SITE_URL) ||
    toOrigin(process.env.LIVE_SITE_URL) ||
    toOrigin(process.env.NEXT_PUBLIC_SITE_URL) ||
    FALLBACK_ORIGIN
  );
}

export function getSiteHost(): string {
  return new URL(getSiteOrigin()).hostname;
}

export function getSiteName(): string {
  return process.env.SEO_SITE_NAME?.trim() || FALLBACK_NAME;
}

export function getSiteDescription(): string {
  return process.env.SEO_SITE_DESCRIPTION?.trim() || FALLBACK_DESCRIPTION;
}

/** Stable id used in the audit overview, e.g. "moksha-voyage". */
export function getSiteId(): string {
  return getSiteName()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Lower-case words/domains that count as the brand being mentioned or cited. */
export function getBrandTerms(): string[] {
  const configured = list(process.env.SEO_BRAND_TERMS, ",").map((term) => term.toLowerCase());
  if (configured.length) return configured;
  const host = getSiteHost().replace(/^www\./, "");
  return Array.from(new Set([getSiteName().toLowerCase(), host]));
}

export function getLlmQueries(): string[] {
  const configured = list(process.env.SEO_LLM_QUERIES, "|");
  return configured.length ? configured : FALLBACK_LLM_QUERIES;
}

/** Host without "www.", used to decide whether a URL belongs to the audited site. */
const bareHost = (host: string) => host.toLowerCase().replace(/^www\./, "");

/**
 * An audit may only target the configured site (with or without "www"). Without this, anyone who can
 * reach the audit could make the server fetch any address, including internal ones.
 */
export function isAuditedOrigin(candidate: string | undefined | null): boolean {
  const origin = toOrigin(candidate);
  if (!origin) return false;
  return bareHost(new URL(origin).hostname) === bareHost(getSiteHost());
}

/** The user agent the audit crawler identifies itself with. */
export function getCrawlerUserAgent(): string {
  const token = getSiteName().replace(/[^A-Za-z0-9]+/g, "");
  return `${token}SEOAudit/1.0 (+real-crawl; ${getSiteOrigin()})`;
}
