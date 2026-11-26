/**
 * Evidence for one site: up to ten prioritised public pages read through the SSRF-safe fetcher, counts and technical SEO signals
 * measured from them, the sitemap size, Google PageSpeed (mobile, home page, with Lighthouse's screenshot) and whether
 * Google's Knowledge Graph knows the brand. Nothing is estimated: a measurement that could not be taken is null.
 */

import { digestPage, siteMetrics, visibleText, type PageDigest, type SiteDigest, type SiteMetrics } from '../website-intelligence/competitor-ai';
import { safeFetch, type SafeFetchDeps } from '../website-intelligence/safe-fetch';
import { googleApiKey } from '../website-intelligence/website-google';
import { runPageSpeed, type FieldBlock, type MetricCategory } from '../website-intelligence/website-pagespeed';
import { knowledgeGraphApiKey, lookupBrandPresence } from '../website-intelligence/website-brand';
import { siteCatalogue } from './analyzer-offers';
import type { AnalyzerRenderer } from './analyzer-renderer';
import type { SiteSocials } from './analyzer-social';
import { inspectJourneys, type JourneyEvidence, type JourneyRule } from './journey-intelligence';
import { publicObservations, type PublicObservation } from './business-intelligence';

export const MAX_PAGES_PER_SITE = 10;
/** One slow site must not hold the whole run: its measurement is abandoned after this. */
export const SITE_TIMEOUT_MS = 150_000;

export interface TechSignals {
  titleLength: number;
  descriptionLength: number;
  h1Count: number;
  headline: string | null;
  canonical: boolean;
  openGraph: boolean;
  viewport: boolean;
  lang: string | null;
  imagesTotal: number;
  imagesWithAlt: number;
  internalLinks: number;
  hasBlog: boolean | null;
  /** Newest publish/modified date found in the pages read (meta, JSON-LD or <time>), not in the future. */
  latestDate: string | null;
  robotsTxt: boolean | null;
  sitemapUrls: number | null;
  /** Sitemap pages with a <lastmod> in the last 30 / 90 days: how actively the site publishes. Null without dates. */
  sitemapRecent30?: number | null;
  sitemapRecent90?: number | null;
  /** Newest <lastmod> in the sitemap (YYYY-MM-DD). */
  sitemapLatest?: string | null;
}

export type FeatureState = 'present' | 'absent_confirmed' | 'not_observed' | 'render_failed';
export type PageKind = 'home' | 'about' | 'contact' | 'services' | 'products' | 'pricing' | 'events' | 'projects' | 'gallery' | 'blog' | 'team' | 'faq' | 'locations' | 'clients' | 'testimonials' | 'other';
export interface FeatureAssertion {
  state: FeatureState;
  evidence: { url: string; snippet: string; method: 'static' | 'rendered' }[];
}
export interface SiteFeatures {
  blog: FeatureAssertion;
  /** A product range or catalogue is shown. */
  products?: FeatureAssertion;
  /** Visitors can buy on the site (cart, checkout, "buy now"). */
  onlineStore?: FeatureAssertion;
  /** At least one price is written on a page. */
  prices?: FeatureAssertion;
  /** Events, exhibitions or registrations are offered. */
  events?: FeatureAssertion;
  contactForm: FeatureAssertion;
  phone: FeatureAssertion;
  email: FeatureAssertion;
  whatsapp: FeatureAssertion;
  portfolio: FeatureAssertion;
  clients: FeatureAssertion;
  testimonials: FeatureAssertion;
}
export interface CrawlCoverage {
  discovered: number;
  selected: number;
  read: number;
  rendered: number;
  failed: number;
  score: number;
  status: 'complete' | 'partial' | 'insufficient';
  pageTypes: PageKind[];
  warnings: string[];
}

/** The company's own Google Search Console data (last 28 days); only ever attached to the own site. */
export interface OwnSearch {
  property: string;
  range: { start: string; end: string };
  totals: { clicks: number; impressions: number; ctr: number; position: number };
  queries: { query: string; clicks: number; impressions: number; position: number }[];
}

export interface SiteEvidence {
  businessPages?:PublicObservation[];
  journeys?:JourneyEvidence[];
  url: string;
  domain: string;
  role: 'own' | 'competitor';
  reachable: boolean;
  error: string | null;
  /** The other website this address sends visitors to (then nothing is read or scored). Runs before 2026-10-26: absent. */
  movedTo?: string | null;
  /** The star rating the site states in its own structured data; not verified on Google, never part of a score. */
  statedRating?: StatedRating | null;
  name: string | null;
  title: string | null;
  description: string | null;
  image: string | null;
  screenshot: string | null;
  https: boolean;
  /** h1 and prices per page are stored from 2026-10-23 on, so a later check can say what changed on that page. */
  pages: { url: string; title: string; description: string; words: number; headings: number; ctas: string[]; kind?: PageKind; method?: 'static' | 'rendered'; h1?: string | null; prices?: string[] }[];
  metrics: SiteMetrics;
  tech: TechSignals | null;
  features?: SiteFeatures;
  coverage?: CrawlCoverage;
  speed: { performance: number | null; seo: number | null; accessibility: number | null; bestPractices: number | null; lcpMs: number | null; cls: number | null; tbtMs: number | null; field?: RealUserSpeed | null } | null;
  /** How pages were chosen and read; "what changed" only compares pages between runs of the same version. */
  crawlVersion?: number;
  speedMeta?: { measuredAt: string; requestedUrl: string; finalUrl: string; device: 'mobile'; lighthouseVersion: string | null } | null;
  speedError: string | null;
  brand: { status: 'matched' | 'possible' | 'not_found' | 'unavailable'; name: string | null; description: string | null; wikipediaUrl: string | null } | null;
  search?: OwnSearch | null;
  /** Social profiles the site links to, with public numbers where an official API gives them (added 2026-10-23). */
  socials?: SiteSocials;
}

/** "https://www.example.com/path?x" or "example.com" → { url: "https://www.example.com/", domain: "example.com" }. */
export function normalizeSite(input: string): { url: string; domain: string } | null {
  const raw = input.trim();
  if (!raw || raw.length > 300) return null;
  try {
    const u = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
    if (!/^https?:$/.test(u.protocol) || !u.hostname.includes('.') || u.username || u.password) return null;
    if (/^\d+\.\d+\.\d+\.\d+$/.test(u.hostname) || u.hostname.endsWith('.local') || u.hostname === 'localhost') return null;
    return { url: `${u.protocol}//${u.host.toLowerCase()}/`, domain: u.hostname.toLowerCase().replace(/^www\./, '') };
  } catch {
    return null;
  }
}

const GENERIC_TITLE_PART = /^(home|home ?page|welcome|index|main|official (web)?site)$/i;
const decodeEntities = (s: string) =>
  s.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#0?39;|&apos;/g, "'").replace(/&nbsp;/g, ' ').replace(/&#(\d+);/g, (_, n: string) => String.fromCharCode(Number(n)));

/** The brand name a site uses for itself: og:site_name, else the first meaningful part of the home page title. */
export function siteName(html: string, title: string): string | null {
  const og = /<meta\b[^>]*(?:property|name)\s*=\s*["']og:site_name["'][^>]*>/i.exec(html)?.[0];
  const ogName = og ? decodeEntities(/content\s*=\s*["']([^"']+)/i.exec(og)?.[1] ?? '').trim() : null;
  if (ogName) return ogName.slice(0, 120);
  const part = decodeEntities(title)
    .split(/\s+[|\-–—:•]\s+/)
    .map((p) => p.trim())
    .find((p) => p && !GENERIC_TITLE_PART.test(p));
  return part ? part.slice(0, 120) : null;
}

/**
 * Only the home page, for showing a site's name while its address is typed. `movedTo`: the other website the address
 * sends visitors to (see `movedTo`); then the name is that other site's and should not be trusted.
 */
export async function probeSiteName(url: string, deps: SafeFetchDeps): Promise<{ name: string | null; reachable: boolean; movedTo: string | null }> {
  try {
    const res = await safeFetch(url, { headers: UA, timeoutMs: 8_000, maxBytes: 600_000 }, deps);
    if (!res.ok || !/text\/html|application\/xhtml/i.test(res.headers.get('content-type') ?? 'text/html')) return { name: null, reachable: res.ok, movedTo: null };
    return { name: siteName(res.body, digestPage(res.body, new URL(res.url)).title), reachable: true, movedTo: movedTo(url, res.url, res.body) };
  } catch {
    return { name: null, reachable: false, movedTo: null };
  }
}

/** The home page's name, title, description, headings and opening text: what competitor suggestions are based on. */
const ADDRESS_KEYS = ['streetAddress', 'addressLocality', 'addressRegion', 'postalCode', 'addressCountry'] as const;


function addressLine(value: unknown): string {
  if (typeof value === 'string') return value.trim();
  if (Array.isArray(value)) return value.map(addressLine).filter(Boolean).join(' | ');
  if (!value || typeof value !== 'object') return '';
  const a = value as Record<string, unknown>;
  return ADDRESS_KEYS.map((k) => {
    const v = a[k];
    return typeof v === 'string' ? v.trim() : v && typeof v === 'object' && typeof (v as { name?: unknown }).name === 'string' ? (v as { name: string }).name : '';
  }).filter(Boolean).join(', ');
}
export function structuredAddresses(html: string): string[] {
  const out: string[] = [];
  const walk = (node: unknown, owner: string, depth: number) => {
    if (!node || typeof node !== 'object' || depth > 10 || out.length >= 12) return;
    if (Array.isArray(node)) return node.forEach((n) => walk(n, owner, depth + 1));
    const o = node as Record<string, unknown>;
    const type = Array.isArray(o['@type']) ? o['@type'].join('/') : typeof o['@type'] === 'string' ? o['@type'] : '';
    const name = typeof o.name === 'string' ? o.name : '';
    const label = type && type !== 'PostalAddress' ? [type, name].filter(Boolean).join(' ') : owner;
    const line = type === 'PostalAddress' ? addressLine(o) : addressLine(o.address);
    if (line) out.push(`${label || 'Address'}: ${line}`);
    for (const [k, v] of Object.entries(o)) if (k !== 'address' && v && typeof v === 'object') walk(v, label, depth + 1);
  };
  let parsed = false;
  for (const m of html.matchAll(/<script\b[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      walk(JSON.parse(m[1]!.trim()), '', 0);
      parsed = true;
    } catch {
      /* not JSON */
    }
  }
  if (!parsed) {
    const fields = new RegExp(`"(${ADDRESS_KEYS.join('|')})"\\s*:\\s*"([^"]{1,120})"`, 'gi');
    const flat = [...new Set([...html.matchAll(fields)].map((m) => `${m[1]}: ${m[2]}`))].slice(0, 12);
    if (flat.length) out.push(`Address fields: ${flat.join('; ')}`);
  }
  return [...new Set(out.map((s) => s.replace(/\s+/g, ' ').slice(0, 220)))];
}

/** Words that sit next to a location on a page ("Venue:", "Head Office", "Visit us", a PIN/ZIP code…). */
const PLACE_WORDS = /\b(address|venue|head ?office|regional office|branch(es)?|office(s)?|stores?|showrooms?|outlets?|located|location(s)?|visit us|find us|reach us|headquarters|hq|campus|clinic|hospital|factory|plant|warehouse|serving|service areas?|we serve|deliver(y|ing)? (to|across|in))\b/gi;
const POSTCODE = /\b(\d{3}\s?\d{3}|\d{5}(-\d{4})?|[A-Z]{1,2}\d[A-Z\d]? ?\d[A-Z]{2})\b/g;

/** Short text pieces around place words and postcodes: where addresses, venues and branches are written. */
export function placeSnippets(text: string, max = 14): string[] {
  const clean = text.replace(/\s+/g, ' ');
  const spans: [number, number][] = [];
  for (const re of [PLACE_WORDS, POSTCODE]) {
    for (const m of clean.matchAll(re)) spans.push([Math.max(0, m.index! - 90), Math.min(clean.length, m.index! + m[0].length + 160)]);
  }
  spans.sort((a, b) => a[0] - b[0]);
  const merged: [number, number][] = [];
  for (const s of spans) {
    const last = merged[merged.length - 1];
    if (last && s[0] <= last[1]) last[1] = Math.max(last[1], s[1]);
    else merged.push([...s]);
  }
  return merged.slice(0, max).map(([a, b]) => clean.slice(a, Math.min(b, a + 420)).trim());
}

/** Place names in embedded Google Maps (iframe `q=` or the place name inside an embed `pb=`). */
export function mapPlaces(html: string): string[] {
  const out: string[] = [];
  for (const m of html.matchAll(/<iframe\b[^>]*src\s*=\s*["']([^"']*google\.[^"']*\/maps[^"']*)["']/gi)) {
    const src = m[1]!.replace(/&amp;/g, '&');
    try {
      const u = new URL(src, 'https://www.google.com');
      const q = u.searchParams.get('q');
      if (q) out.push(q);
      const pb = u.searchParams.get('pb') ?? '';
      for (const p of pb.matchAll(/!2s([^!]+)/g)) out.push(decodeURIComponent(p[1]!.replace(/\+/g, ' ')));
    } catch {
      /* not a URL */
    }
  }
  return [...new Set(out.map((s) => s.trim()).filter((s) => s.length > 2))].slice(0, 6);
}

/**
 * Where a business says it is, from one page: structured address data, `<address>` tags, embedded maps, the footer,
 * text around place words and postcodes, and phone numbers. Plain text for the location prompt.
 */
export function locationClues(html: string): string {
  const clues: string[] = [];
  const structured = structuredAddresses(html);
  if (structured.length) clues.push(`Structured address data:\n- ${structured.join('\n- ')}`);
  const tags = [...new Set([...html.matchAll(/<address\b[\s\S]*?<\/address>/gi)].map((m) => visibleText(m[0]).replace(/\s+/g, ' ').trim()).filter(Boolean))].slice(0, 6);
  if (tags.length) clues.push(`Address tags:\n- ${tags.map((t) => t.slice(0, 300)).join('\n- ')}`);
  const maps = mapPlaces(html);
  if (maps.length) clues.push(`Embedded map places: ${maps.join(' | ')}`);
  const footers = [...html.matchAll(/<footer\b[\s\S]*?<\/footer>/gi)].map((m) => visibleText(m[0])).join(' ').replace(/\s+/g, ' ').trim();
  if (footers) clues.push(`Footer: ${footers.slice(0, 2500)}`);
  const body = /<body\b[\s\S]*<\/body>/i.exec(html)?.[0] ?? html;
  const withoutFooter = body.replace(/<footer\b[\s\S]*?<\/footer>/gi, ' ');
  const snippets = placeSnippets(visibleText(withoutFooter));
  if (snippets.length) clues.push(`Text near place words:\n- ${snippets.join('\n- ')}`);
  const phones = [...new Set([...html.matchAll(/href\s*=\s*["']tel:([^"']{4,30})["']/gi)].map((m) => m[1]!.trim()))].slice(0, 4);
  if (phones.length) clues.push(`Phone numbers: ${phones.join(', ')}`);
  return clues.join('\n');
}

/** Links that usually lead to addresses: contact, about, locations, branches, stores, venue… (same site, best first). */
const PLACE_LINK = /(contact|reach|find-?us|visit|location|branch|store|outlet|showroom|office|venue|address|dealer|cent(er|re)s?|clinic|campus|about)/i;
const placeLinkRank = (s: string) => (/(contact|reach|find-?us|visit)/i.test(s) ? 0 : /(location|branch|store|outlet|showroom|office|venue|address|dealer|cent(er|re)|clinic|campus)/i.test(s) ? 1 : 2);

export function placeLinks(html: string, homeUrl: URL, max = 4): string[] {
  const host = homeUrl.hostname.replace(/^www\./, '');
  const found = new Map<string, number>();
  for (const m of html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)) {
    const href = /href\s*=\s*["']([^"'#]+)["']/i.exec(m[1]!)?.[1];
    if (!href || /^(mailto|tel|javascript):/i.test(href)) continue;
    const label = visibleText(m[2]!).slice(0, 60);
    try {
      const u = new URL(href, homeUrl);
      if (u.hostname.replace(/^www\./, '') !== host || !/^https?:$/.test(u.protocol)) continue;
      if (/\.(pdf|jpe?g|png|webp|zip|docx?)$/i.test(u.pathname) || u.pathname === '/' || u.pathname === homeUrl.pathname) continue;
      const key = `${u.origin}${u.pathname}`.replace(/\/$/, '');
      const text = `${u.pathname} ${label}`;
      if (!PLACE_LINK.test(text)) continue;
      const rank = placeLinkRank(text);
      if (!found.has(key) || found.get(key)! > rank) found.set(key, rank);
    } catch {
      /* not a URL */
    }
  }
  return [...found.entries()].sort((a, b) => a[1] - b[1]).slice(0, max).map(([url]) => url);
}
export async function readSiteLocations(url: string, deps: SafeFetchDeps): Promise<{ reachable: boolean; title: string; description: string; text: string; clues: string; pages: string[] }> {
  const fetchPage = async (pageUrl: string) => {
    try {
      const res = await safeFetch(pageUrl, { headers: UA, timeoutMs: 10_000, maxBytes: 1_500_000 }, deps);
      if (!res.ok || !/text\/html|application\/xhtml/i.test(res.headers.get('content-type') ?? 'text/html')) return null;
      return { url: res.url, html: res.body };
    } catch {
      return null;
    }
  };
  const home = await fetchPage(url);
  if (!home) return { reachable: false, title: '', description: '', text: '', clues: '', pages: [] };
  const homeUrl = new URL(home.url);
  const page = digestPage(home.html, homeUrl);
  const others = (await Promise.all(placeLinks(home.html, homeUrl).map(fetchPage))).filter((p): p is { url: string; html: string } => Boolean(p));
  const host = homeUrl.hostname.replace(/^www\./, '');
  const sections = [{ url: home.url, html: home.html }, ...others].map((p) => `## Page ${new URL(p.url).pathname || '/'}\n${locationClues(p.html)}`);
  const clues = [...sections, `Domain ending: .${host.split('.').slice(1).join('.') || host}`].join('\n\n').slice(0, 14_000);
  return { reachable: true, title: page.title, description: page.description, text: page.text, clues, pages: [home.url, ...others.map((p) => p.url)] };
}

export async function readHomeSummary(url: string, deps: SafeFetchDeps): Promise<{ reachable: boolean; name: string | null; title: string; description: string; headings: string[]; text: string; clues: string }> {
  const empty = { name: null, title: '', description: '', headings: [], text: '', clues: '' };
  try {
    const res = await safeFetch(url, { headers: UA, timeoutMs: 10_000, maxBytes: 1_500_000 }, deps);
    if (!res.ok || !/text\/html|application\/xhtml/i.test(res.headers.get('content-type') ?? 'text/html')) return { reachable: res.ok, ...empty };
    const page = digestPage(res.body, new URL(res.url));
    return { reachable: true, name: siteName(res.body, page.title), title: page.title, description: page.description, headings: page.headings.map((h) => h.replace(/^H\d: /, '')), text: page.text, clues: locationClues(res.body) };
  } catch {
    return { reachable: false, ...empty };
  }
}

const DATE_PATTERNS = [
  /<meta\b[^>]*(?:property|name)\s*=\s*["'](?:article:modified_time|article:published_time|og:updated_time)["'][^>]*content\s*=\s*["']([^"']+)/gi,
  /"date(?:Modified|Published)"\s*:\s*"([^"]+)"/gi,
  /<time\b[^>]*datetime\s*=\s*["']([^"']+)/gi,
];

/** Technical and freshness signals from the home page and the other pages read. */
export function techSignals(homeHtml: string, homeUrl: URL, allHtml: string[], now = new Date()): Omit<TechSignals, 'robotsTxt' | 'sitemapUrls'> {
  const head = /<head[\s\S]*?<\/head>/i.exec(homeHtml)?.[0] ?? homeHtml;
  const title = visibleText(/<title[^>]*>([\s\S]*?)<\/title>/i.exec(homeHtml)?.[1] ?? '');
  // The value is read up to its own closing quote, so "India's" inside double quotes is kept whole.
  const descTag = /<meta\b[^>]*name\s*=\s*["']description["'][^>]*>/i.exec(homeHtml)?.[0] ?? '';
  const descMatch = /content\s*=\s*(?:"([^"]*)"|'([^']*)')/i.exec(descTag);
  const description = descMatch?.[1] ?? descMatch?.[2] ?? '';
  const h1s = [...homeHtml.matchAll(/<h1\b[^>]*>([\s\S]*?)<\/h1>/gi)].map((m) => visibleText(m[1] ?? '')).filter(Boolean);
  const imgs = [...homeHtml.matchAll(/<img\b[^>]*>/gi)].map((m) => m[0]);
  const host = homeUrl.hostname.replace(/^www\./, '');
  let internal = 0;
  let blog = false;
  for (const m of homeHtml.matchAll(/<a\b[^>]*href\s*=\s*["']([^"'#]+)["']/gi)) {
    try {
      const u = new URL(m[1]!, homeUrl);
      if (u.hostname.replace(/^www\./, '') !== host) continue;
      internal += 1;
      if (/\/(blog|news|articles?|insights|stories|updates|press)(\/|$)/i.test(u.pathname)) blog = true;
    } catch {
      /* not a URL */
    }
  }
  let latest: number | null = null;
  for (const html of allHtml) {
    for (const pattern of DATE_PATTERNS) {
      for (const m of html.matchAll(pattern)) {
        const t = Date.parse(m[1] ?? '');
        if (Number.isFinite(t) && t <= now.getTime() + 86_400_000 && t > Date.parse('2000-01-01') && (latest === null || t > latest)) latest = t;
      }
    }
  }
  return {
    titleLength: title.length,
    descriptionLength: description.trim().length,
    h1Count: h1s.length,
    headline: h1s[0]?.slice(0, 200) ?? null,
    canonical: /<link\b[^>]*rel\s*=\s*["']canonical["']/i.test(head),
    openGraph: /<meta\b[^>]*property\s*=\s*["']og:(title|image)["']/i.test(head),
    viewport: /<meta\b[^>]*name\s*=\s*["']viewport["']/i.test(head),
    lang: /<html\b[^>]*\blang\s*=\s*["']([^"']+)/i.exec(homeHtml)?.[1]?.slice(0, 20) ?? null,
    imagesTotal: imgs.length,
    imagesWithAlt: imgs.filter((tag) => /\balt\s*=\s*["'][^"']+["']/i.test(tag)).length,
    internalLinks: internal,
    hasBlog: blog,
    latestDate: latest === null ? null : new Date(latest).toISOString().slice(0, 10),
  };
}

/** First match wins, so the specific kinds come before the broad ones (pricing before products, team before about). */
const PAGE_RULES: [Exclude<PageKind, 'home' | 'other'>, RegExp][] = [
  // Every word starts at a word boundary, so "corporate" is not read as "rate" or "workshop" as "shop".
  ['contact', /\b(contact|enquir|inquir|get\s+in\s+touch|reach\s+us|connect)/i],
  ['pricing', /\b(pricing|prices?\b|price\s+list|plans?\b|packages?|rates?\b|tariffs?|fees?\b)/i],
  ['events', /\b(events?\b|exhibit(or|ion|ing)?s?\b|expos?\b|stalls?\b|booths?\b|book\s+a\s+(stall|booth|space)|registration|register\b|visitors?\b|delegates?|agenda|conferences?|summits?|webinars?|tickets?)/i],
  ['products', /\b(products?|shop\b|store\b|collections?|catalog(ue)?|buy\b|categor(y|ies)|range\b|brochure)/i],
  ['services', /\b(services?|solutions?|programmes?|programs?\b|treatments?|courses?|offerings?|what\s+we\s+do|capabilities)/i],
  ['projects', /\b(projects?|portfolio|case\s+stud|our\s+work|showcase|work\b)/i],
  ['gallery', /\b(gallery|photos?|images|media\b|videos?)/i],
  ['blog', /\b(blogs?|news|articles?|insights?|stories|updates|press|resources?)/i],
  ['team', /\b(team\b|our\s+people|leadership|founders?|management|faculty|doctors|experts)/i],
  ['faq', /\b(faqs?\b|questions|help\b|support\b)/i],
  ['locations', /\b(locations?|branch(es)?|outlets?|find\s+us|offices?\b|directions|store\s+locator)/i],
  ['about', /\b(about|who\s+we\s+are|our\s+story|company|mission)/i],
  ['clients', /\b(clients?|customers?|brands?|partners?)/i],
  ['testimonials', /\b(testimonials?|reviews?|success\s+stor)/i],
];

/** Sections whose sub-pages share their kind: /services/mobile-booth is a service page, not an events page. */
const PARENT_KINDS = new Set<PageKind>(['services', 'products', 'projects', 'blog', 'events', 'gallery', 'team', 'locations']);

export function classifyPage(url: URL, label = ''): PageKind {
  if (url.pathname === '/' || !url.pathname) return 'home';
  const segments = url.pathname.split('/').filter(Boolean);
  if (segments.length > 1) {
    const parent = PAGE_RULES.find(([, pattern]) => pattern.test(segments[0]!.replace(/[-_]+/g, ' ')))?.[0];
    if (parent && PARENT_KINDS.has(parent)) return parent;
  }
  const value = `${url.pathname.replace(/[-_/]+/g, ' ')} ${label}`;
  return PAGE_RULES.find(([, pattern]) => pattern.test(value))?.[0] ?? 'other';
}

interface PageCandidate { url: URL; kind: PageKind; via: 'link' | 'sitemap'; order: number }

export function selectImportantPages(homeHtml: string, homeUrl: URL, sitemapPages: string[], limit: number, preferredPaths: readonly RegExp[] = []): PageCandidate[] {
  const host = homeUrl.hostname.replace(/^www\./, '');
  const candidates = new Map<string, PageCandidate>();
  const add = (raw: string, label: string, via: 'link' | 'sitemap', order: number) => {
    try {
      const url = new URL(raw, homeUrl);
      if (!/^https?:$/.test(url.protocol) || url.hostname.replace(/^www\./, '') !== host || url.pathname === '/' || FILE_OR_LEGAL.test(url.pathname)) return;
      // Avoid unrelated injected/spam URLs displacing real event and business pages.
      if (/casino|gambling|slot-machine|poker|sports-betting|payday-loan/i.test(url.pathname)) return;
      url.hash = '';
      url.search = '';
      const key = url.href.replace(/\/$/, '');
      if (!candidates.has(key)) candidates.set(key, { url, kind: classifyPage(url, label), via, order });
    } catch {
      return;
    }
  };
  let order = 0;
  for (const match of homeHtml.matchAll(/<a\b[^>]*href\s*=\s*["']([^"'#]+)["'][^>]*>([\s\S]*?)<\/a>/gi)) add(match[1]!, visibleText(match[2] ?? ''), 'link', order++);
  for (const url of sitemapPages) add(url, '', 'sitemap', order++);
  // One page of each important kind first, the site's own menu links before sitemap entries; then the rest.
  const priority: PageKind[] = ['contact', 'about', 'products', 'services', 'pricing', 'events', 'projects', 'blog', 'testimonials', 'clients', 'team', 'gallery', 'faq', 'locations'];
  const chosen: PageCandidate[] = [];
  const byMenuFirst = [...candidates.values()].sort((a, b) => (a.via === b.via ? a.order - b.order : a.via === 'link' ? -1 : 1));
  // A profile may reserve up to four slots for its conversion journeys; default discovery is unchanged.
  for (const pattern of preferredPaths.slice(0,6)) {
    const match = byMenuFirst.find(candidate=>pattern.test(candidate.url.pathname) && !chosen.includes(candidate));
    if(match && chosen.length < limit)chosen.push(match);
  }
  for (const kind of priority) {
    const match = byMenuFirst.find((candidate) => candidate.kind === kind && !chosen.includes(candidate));
    if (match && chosen.length < limit) chosen.push(match);
  }
  const score = (candidate: PageCandidate) => (candidate.via === 'link' ? 1000 : 0) + (candidate.kind === 'other' ? 0 : 500) - candidate.order;
  for (const candidate of [...candidates.values()].sort((a, b) => score(b) - score(a))) {
    if (chosen.length >= limit) break;
    if (!chosen.includes(candidate)) chosen.push(candidate);
  }
  return chosen;
}

/** Number of page URLs in the sitemap(s): robots.txt "Sitemap:" lines first, then /sitemap.xml; indexes are followed one level. */
export function sitemapLocs(xml: string): { pages: string[]; children: string[]; entries: { loc: string; lastmod: string | null }[] } {
  if (/<sitemapindex\b/i.test(xml)) return { pages: [], children: [...xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/gi)].map((m) => m[1]!), entries: [] };
  const entries = [...xml.matchAll(/<url\b[^>]*>([\s\S]*?)<\/url>/gi)]
    .map((m) => ({ loc: /<loc>\s*([^<\s]+)\s*<\/loc>/i.exec(m[1] ?? '')?.[1] ?? '', lastmod: /<lastmod>\s*([^<\s]+)\s*<\/lastmod>/i.exec(m[1] ?? '')?.[1] ?? null }))
    .filter((e) => e.loc);
  // A sitemap written without <url> wrappers still lists its <loc>s.
  const pages = entries.length ? entries.map((e) => e.loc) : [...xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/gi)].map((m) => m[1]!);
  return { pages, children: [], entries: entries.length ? entries : pages.map((loc) => ({ loc, lastmod: null })) };
}

const FILE_OR_LEGAL = /\.(pdf|jpe?g|png|gif|webp|svg|zip|docx?|xlsx?|mp4|xml)$|\/(wp-admin|login|signin|cart|checkout|account|privacy|terms|cookie|tag|category|author|feed)\b/i;

/** Publishing activity from <lastmod>, and the newest content pages worth reading. */
export function sitemapActivity(entries: { loc: string; lastmod: string | null }[], host: string, now = new Date()) {
  const day = 86_400_000;
  const dated = entries.map((e) => ({ ...e, t: e.lastmod ? Date.parse(e.lastmod) : NaN })).filter((e) => Number.isFinite(e.t) && e.t <= now.getTime() + day);
  const within = (days: number) => dated.filter((e) => now.getTime() - e.t <= days * day).length;
  const sameHost = (loc: string) => {
    try {
      const u = new URL(loc);
      return u.hostname.replace(/^www\./, '') === host && u.pathname !== '/' && !FILE_OR_LEGAL.test(u.pathname);
    } catch {
      return false;
    }
  };
  const candidates = (dated.length ? [...dated].sort((a, b) => b.t - a.t) : entries).map((e) => e.loc).filter(sameHost);
  return {
    recent30: dated.length ? within(30) : null,
    recent90: dated.length ? within(90) : null,
    latest: dated.length ? new Date(Math.max(...dated.map((e) => e.t))).toISOString().slice(0, 10) : null,
    newest: [...new Set(candidates)].slice(0, 20),
  };
}

const UA = { 'user-agent': 'Media360CompetitorAnalyzer/1.0' };

async function fetchText(url: string, deps: SafeFetchDeps, maxBytes = 1_500_000): Promise<{ url: URL; body: string; type: string } | null> {
  try {
    const res = await safeFetch(url, { headers: UA, timeoutMs: 12_000, maxBytes }, deps);
    if (!res.ok) return null;
    return { url: new URL(res.url), body: res.body, type: res.headers.get('content-type') ?? '' };
  } catch {
    return null;
  }
}

async function siteStructure(origin: string, deps: SafeFetchDeps): Promise<{ robotsTxt: boolean | null; sitemapUrls: number | null; sitemapRecent30: number | null; sitemapRecent90: number | null; sitemapLatest: string | null; pages: string[] }> {
  const robots = await fetchText(`${origin}/robots.txt`, deps, 200_000);
  const robotsOk = robots !== null && !/<html/i.test(robots.body.slice(0, 500));
  const declared = robotsOk ? [...robots!.body.matchAll(/^\s*sitemap:\s*(\S+)/gim)].map((m) => m[1]!).slice(0, 3) : [];
  const candidates = declared.length ? declared : [`${origin}/sitemap.xml`];
  const seen = new Set<string>();
  const entries: { loc: string; lastmod: string | null }[] = [];
  let found = false;
  for (const candidate of candidates) {
    const doc = await fetchText(candidate, deps, 6_000_000);
    if (!doc || !/<(urlset|sitemapindex)\b/i.test(doc.body)) continue;
    found = true;
    const parsed = sitemapLocs(doc.body);
    parsed.pages.forEach((p) => seen.add(p));
    entries.push(...parsed.entries);
    for (const child of parsed.children.slice(0, 5)) {
      const sub = await fetchText(child, deps, 6_000_000);
      if (!sub) continue;
      const inner = sitemapLocs(sub.body);
      inner.pages.forEach((p) => seen.add(p));
      entries.push(...inner.entries);
    }
  }
  const activity = sitemapActivity(entries, new URL(origin).hostname.replace(/^www\./, ''));
  return { robotsTxt: robots === null ? null : robotsOk, sitemapUrls: found ? seen.size : null, sitemapRecent30: activity.recent30, sitemapRecent90: activity.recent90, sitemapLatest: activity.latest, pages: [...new Set([...activity.newest, ...seen])] };
}

const TWO_PART_SUFFIX = /^(co|com|net|org|gov|ac|edu|nic|res|gen|firm|ind|ltd|plc)$/;

/** The brand part of a host: "acme" for www.acme.co.in, shop.acme.com and acme.org. */
export function brandOf(host: string): string {
  const labels = host.toLowerCase().replace(/^www\./, '').split('.').filter(Boolean);
  if (labels.length < 2) return labels[0] ?? '';
  const suffix = labels.length >= 3 && TWO_PART_SUFFIX.test(labels[labels.length - 2]!) && labels[labels.length - 1]!.length === 2 ? 2 : 1;
  return labels[labels.length - 1 - suffix] ?? '';
}

/** True when two hosts belong to the same business: same brand (keralaayurveda.biz → keralaayurveda.com, www, subdomains). */
export function sameBusinessHost(a: string, b: string) {
  return brandOf(a) === brandOf(b);
}

/**
 * Where a page sends its visitors with a meta refresh or a script (`window.location.href = "…"`, `location.replace(…)`),
 * when that is an absolute address; null otherwise.
 */
export function pageRedirect(html: string, base: URL): string | null {
  const meta = /<meta\b[^>]*http-equiv\s*=\s*["']?refresh["']?[^>]*content\s*=\s*["'][^"']*url\s*=\s*([^"'>\s]+)/i.exec(html)?.[1];
  const script = /(?:window\.|document\.|top\.)?location(?:\.href)?\s*=\s*["']([^"']+)["']|location\.(?:replace|assign)\(\s*["']([^"']+)["']/i.exec(html);
  const target = meta ?? script?.[1] ?? script?.[2];
  if (!target || !/^https?:\/\//i.test(target)) return null;
  try {
    return new URL(target, base).href;
  } catch {
    return null;
  }
}

/**
 * The other website a home page hands its visitors to: an HTTP redirect to another business, or a short page that
 * forwards by script / meta refresh ("Redirecting in 5 seconds…"). Null when the page is the business's own.
 */
export function movedTo(requested: string, finalUrl: string, html: string): string | null {
  const host = (u: string) => {
    try {
      return new URL(u).hostname.replace(/^www\./, '');
    } catch {
      return '';
    }
  };
  const from = host(requested);
  const landed = host(finalUrl);
  if (landed && !sameBusinessHost(from, landed)) return landed;
  const forward = pageRedirect(html, new URL(finalUrl));
  const target = forward ? host(forward) : '';
  if (target && !sameBusinessHost(from, target) && digestPage(html, new URL(finalUrl)).wordCount < 300) return target;
  return null;
}

export async function readSite(url: string, deps: SafeFetchDeps, maxPages = MAX_PAGES_PER_SITE, sitemapPages: string[] = [], renderer: AnalyzerRenderer | null = null, preferredPaths: readonly RegExp[] = []): Promise<{ digest: SiteDigest; html: string; allHtml: string[]; homeUrl: URL; coverage: CrawlCoverage; features: SiteFeatures; screenshot: string | null } | { error: string; movedTo?: string }> {
  let rendered = 0;
  let renderFailed = 0;
  const startHost = new URL(url).hostname;
  // A page that ends up on another business's website (a redirect, or a browser sent away from a bot) is not read:
  // reading it would compare the wrong business (keralaayurveda.biz was once read as google.com).
  const ownSite = (u: string) => sameBusinessHost(startHost, new URL(u).hostname);
  const fetchPage = async (target: string, kind: PageKind, includeScreenshot = false) => {
    const res = await safeFetch(target, { headers: UA, timeoutMs: 12_000, maxBytes: 1_500_000 }, deps);
    if (!res.ok || !/text\/html|application\/xhtml/i.test(res.headers.get('content-type') ?? 'text/html')) return null;
    if (kind !== 'home' && !ownSite(res.url)) return null;
    let pageUrl = new URL(res.url);
    let html = res.body;
    let method: 'static' | 'rendered' = 'static';
    let screenshot: string | null = null;
    const staticDigest = digestPage(html, pageUrl);
    const suspicious = staticDigest.wordCount < 35 || /\bloading(?:\.{3}|…)?\b/i.test(staticDigest.text) || /id=["'](?:root|app)["'][^>]*>\s*<\/div>/i.test(html);
    if (suspicious && renderer && ownSite(pageUrl.href)) {
      try {
        const result = await renderer.render(pageUrl.href, includeScreenshot);
        const renderedDigest = digestPage(result.html, new URL(result.url));
        if (ownSite(result.url) && (renderedDigest.wordCount > staticDigest.wordCount || renderedDigest.contact.form || renderedDigest.headings.length > staticDigest.headings.length)) {
          pageUrl = new URL(result.url);
          html = result.html;
          method = 'rendered';
          screenshot = result.screenshot;
          rendered += 1;
        }
      } catch {
        renderFailed += 1;
      }
    }
    return { url: pageUrl, html, method, kind, screenshot };
  };
  let home: Awaited<ReturnType<typeof fetchPage>>;
  try {
    home = await fetchPage(url, 'home', true);
  } catch (error) {
    return { error: error instanceof Error ? error.message.slice(0, 200) : 'The home page could not be fetched.' };
  }
  if (!home) return { error: 'The home page did not return a readable HTML page.' };
  const moved = movedTo(url, home.url.href, home.html);
  if (moved) return { error: `This address sends visitors to ${moved}, a different website, so it is not compared. To compare that business, add ${moved} itself.`, movedTo: moved };
  const pages: PageDigest[] = [{ ...digestPage(home.html, home.url), kind: 'home', method: home.method }];
  const allHtml = [home.html];
  const candidates = selectImportantPages(home.html, home.url, sitemapPages, maxPages - 1, preferredPaths);
  const extra = await Promise.all(
    candidates.map(async (candidate) => {
      try {
        const page = await fetchPage(candidate.url.href, candidate.kind);
        return page ? { digest: { ...digestPage(page.html, page.url), kind: candidate.kind, method: page.method }, html: page.html } : null;
      } catch {
        return null;
      }
    }),
  );
  for (const page of extra) {
    if (page && !pages.some((p) => p.url === page.digest.url)) {
      pages.push(page.digest);
      allHtml.push(page.html);
    }
  }
  // A site that serves the same JavaScript shell at every address (e.g. base44, many React builders) looks like
  // "a few words, no phone, no form" on every page. Read those pages in a browser; if that is not possible, say the
  // content could not be verified instead of reporting features as absent.
  const shell = shellPages(pages);
  if (shell.length && renderer) {
    for (const i of shell) {
      try {
        const result = await renderer.render(pages[i]!.url, false);
        const renderedDigest = digestPage(result.html, new URL(result.url));
        if (!ownSite(result.url) || (sameText(renderedDigest, pages[i]!) && renderedDigest.wordCount <= pages[i]!.wordCount)) continue;
        pages[i] = { ...renderedDigest, kind: pages[i]!.kind, method: 'rendered' };
        allHtml[i] = result.html;
        rendered += 1;
      } catch {
        renderFailed += 1;
      }
    }
  }
  const unreadShell = shellPages(pages).length;

  const sections = candidates.length === 0 && pages[0]!.wordCount >= 250 ? onePageSections(home.html) : [];
  const onePage = sections.length >= 2;
  const pageTypes = [...new Set([...pages.map((page) => page.kind ?? 'other'), ...sections])];
  const discovered = sitemapPages.length + candidates.filter((candidate) => candidate.via === 'link').length + 1;
  const failed = candidates.length - (pages.length - 1);
  const covers = (kinds: PageKind[]) => kinds.some((kind) => pageTypes.includes(kind));
  const diversity = [['about', 'team'], ['contact', 'locations'], ['services', 'products', 'pricing', 'events'], ['projects', 'gallery', 'clients', 'testimonials'], ['blog']].filter((kinds) => covers(kinds as PageKind[])).length;
  const score = Math.round(Math.min(100, (pages.length / Math.max(1, candidates.length + 1)) * 60 + (diversity / 5) * 40));
  const fullyRead = score >= 80 && pages.length >= Math.min(5, candidates.length + 1);
  const status: CrawlCoverage['status'] = onePage || (fullyRead && !unreadShell) ? 'complete' : score >= 45 && pages.length >= 2 ? 'partial' : 'insufficient';
  const warnings = [
    ...(onePage ? ['One-page website: every section is on the home page, which was read in full.'] : []),
    ...(status !== 'complete' ? ['The website was only partially covered; missing features are not treated as absent.'] : []),
    ...(renderFailed ? [`${renderFailed} JavaScript-rendered page(s) could not be verified.`] : []),
    ...(unreadShell ? [`${unreadShell} page(s) showed only the same JavaScript-rendered shell, so their content could not be verified.`] : []),
  ];
  const coverage: CrawlCoverage = { discovered, selected: candidates.length + 1, read: pages.length, rendered, failed, score, status, pageTypes, warnings };
  const digest = { domain: home.url.hostname.replace(/^www\./, ''), pages };
  return { digest, html: home.html, allHtml, homeUrl: home.url, coverage, features: featureInventory(digest, coverage), screenshot: home.screenshot };
}

/**
 * The star rating a website states about itself in its structured data (schema.org AggregateRating, the data Google
 * may show as stars). It is the site's own claim, not checked against Google, so it is kept apart from scores.
 */
export interface StatedRating {
  value: number;
  best: number;
  ratings: number | null;
  reviews: number | null;
  /** What the rating is for, as the site names it ("Design House"). */
  about: string | null;
  url: string;
}

export function statedRating(html: string, url: string): StatedRating | null {
  const num = (v: unknown) => {
    const n = typeof v === 'number' ? v : typeof v === 'string' ? Number(v.replace(/,/g, '').trim()) : NaN;
    return Number.isFinite(n) ? n : null;
  };
  const build = (r: Record<string, unknown>, about: unknown): StatedRating | null => {
    const value = num(r.ratingValue);
    const best = num(r.bestRating) ?? 5;
    const ratings = num(r.ratingCount);
    const reviews = num(r.reviewCount);
    if (value == null || value <= 0 || value > best || best > 100 || (!ratings && !reviews)) return null;
    return { value, best, ratings, reviews, about: typeof about === 'string' ? about.slice(0, 120) : null, url };
  };
  let found: StatedRating | null = null;
  const walk = (node: unknown, owner: unknown, depth: number) => {
    if (found || !node || typeof node !== 'object' || depth > 10) return;
    if (Array.isArray(node)) return node.forEach((n) => walk(n, owner, depth + 1));
    const o = node as Record<string, unknown>;
    if (o['@type'] === 'AggregateRating') found = build(o, owner);
    else if (o.aggregateRating && typeof o.aggregateRating === 'object') found = build(o.aggregateRating as Record<string, unknown>, o.name);
    for (const v of Object.values(o)) if (v && typeof v === 'object') walk(v, o.name ?? owner, depth + 1);
  };
  for (const m of html.matchAll(/<script\b[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      walk(JSON.parse(m[1]!.trim()), null, 0);
    } catch {
      /* not JSON */
    }
    if (found) return found;
  }
  // JSON-LD that only exists inside a framework payload (escaped quotes): read the fields directly.
  const flat = html.replace(/\\+"/g, '"');
  const field = (key: string) => new RegExp(`"${key}"\\s*:\\s*"?([\\d.,]+)`, 'i').exec(flat)?.[1];
  if (/"@type"\s*:\s*"AggregateRating"/i.test(flat)) return build({ ratingValue: field('ratingValue'), bestRating: field('bestRating'), ratingCount: field('ratingCount'), reviewCount: field('reviewCount') }, null);
  return null;
}

/** The page kinds a home page's in-page menu links point to (#about → about, #our-services → services…). */
export function onePageSections(html: string): PageKind[] {
  const kinds = new Set<PageKind>();
  for (const m of html.matchAll(/<a\b[^>]*href\s*=\s*["']#([a-z][\w-]{1,40})["']/gi)) {
    const kind = classifyPage(new URL(`https://section.test/${m[1]!.toLowerCase()}`));
    if (kind !== 'other' && kind !== 'home') kinds.add(kind);
  }
  return [...kinds];
}

const sameText = (a: PageDigest, b: PageDigest) => a.text.replace(/\s+/g, ' ').trim() === b.text.replace(/\s+/g, ' ').trim();

/**
 * Indexes of pages that are word for word the home page although they are different addresses: one JavaScript shell
 * served everywhere. Only counted when most pages are like that, so a site with a repeated footer is not flagged.
 */
export function shellPages(pages: PageDigest[]): number[] {
  const home = pages[0];
  if (!home || pages.length < 3 || !home.text.trim()) return [];
  const same = pages.map((p, i) => (sameText(p, home) ? i : -1)).filter((i) => i >= 0);
  return same.length >= Math.ceil(pages.length * 0.6) ? same : [];
}

function assertion(pages: PageDigest[], coverage: CrawlCoverage, predicate: (page: PageDigest) => boolean, confirmedBy: PageKind[] = []): FeatureAssertion {
  const matches = pages.filter(predicate);
  if (matches.length) return { state: 'present', evidence: matches.slice(0, 3).map((page) => ({ url: page.url, snippet: page.text.slice(0, 180), method: page.method ?? 'static' })) };
  if (coverage.warnings.some((warning) => warning.includes('JavaScript-rendered'))) return { state: 'render_failed', evidence: [] };
  const confirmed = coverage.status === 'complete' && (!confirmedBy.length || confirmedBy.some((kind) => coverage.pageTypes.includes(kind)));
  return { state: confirmed ? 'absent_confirmed' : 'not_observed', evidence: [] };
}

export function featureInventory(site: SiteDigest, coverage: CrawlCoverage): SiteFeatures {
  const pages = site.pages;
  const text = (page: PageDigest) => `${page.title} ${page.headings.join(' ')} ${page.text}`;
  return {
    blog: assertion(pages, coverage, (page) => page.kind === 'blog' || page.schemaTypes.some((type) => /Article|BlogPosting/i.test(type))),
    contactForm: assertion(pages, coverage, (page) => page.contact.form, ['contact']),
    phone: assertion(pages, coverage, (page) => page.contact.phone || /(?:\+?\d[\d\s().-]{7,}\d)/.test(text(page)), ['contact']),
    email: assertion(pages, coverage, (page) => page.contact.email || /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i.test(text(page)), ['contact']),
    whatsapp: assertion(pages, coverage, (page) => page.contact.whatsapp, ['contact']),
    portfolio: assertion(pages, coverage, (page) => page.kind === 'projects' || /\b(portfolio|case stud|our projects|our work)\b/i.test(text(page))),
    clients: assertion(pages, coverage, (page) => page.kind === 'clients' || /\b(our clients|trusted by|brands we)\b/i.test(text(page))),
    testimonials: assertion(pages, coverage, (page) => page.kind === 'testimonials' || /\b(testimonials?|what (?:our )?clients say|customer stories)\b/i.test(text(page))),
    products: assertion(pages, coverage, (page) => page.kind === 'products' || page.schemaTypes.some((type) => /^(Product|ProductGroup|OfferCatalog)$/i.test(type)) || /\b(add to cart|buy now|shop now|in stock|out of stock|our products|product range)\b/i.test(text(page)), ['products']),
    onlineStore: assertion(pages, coverage, (page) => /\b(add to cart|add to bag|buy now|checkout|view cart|proceed to pay)\b/i.test(`${text(page)} ${page.ctas.join(' ')}`), ['products']),
    prices: assertion(pages, coverage, (page) => PRICE.test(text(page)) || page.schemaTypes.some((type) => /^(Offer|AggregateOffer|PriceSpecification)$/i.test(type)), ['pricing', 'products', 'services', 'events']),
    events: assertion(pages, coverage, (page) => page.kind === 'events' || page.schemaTypes.some((type) => /Event$/i.test(type)) || /\b(register now|book (?:a|your) (?:stall|booth|space)|exhibitor registration|visitor registration|event dates?)\b/i.test(text(page)), ['events']),
  };
}

/** A written price: a currency sign or code next to a number (₹45,000, Rs. 500, INR 1,200, $99, 99 USD). */
export const PRICE = /(?:₹|\brs\.?|\binr\b|\busd\b|\$|€|£)\s?\d[\d,]*(?:\.\d+)?|\b\d[\d,]*(?:\.\d+)?\s?(?:₹|\binr\b|\busd\b|\/-)/i;

function emptyEvidence(site: { url: string; domain: string; role: 'own' | 'competitor' }, error: string | null): SiteEvidence {
  const missing = (): FeatureAssertion => ({ state: 'not_observed', evidence: [] });
  return {
    ...site,
    reachable: false,
    error,
    name: null,
    title: null,
    description: null,
    image: null,
    screenshot: null,
    https: site.url.startsWith('https://'),
    pages: [],
    metrics: siteMetrics({ domain: site.domain, pages: [] }),
    tech: null,
    features: { blog: missing(), contactForm: missing(), phone: missing(), email: missing(), whatsapp: missing(), portfolio: missing(), clients: missing(), testimonials: missing(), products: missing(), onlineStore: missing(), prices: missing(), events: missing() },
    coverage: { discovered: 0, selected: 0, read: 0, rendered: 0, failed: 0, score: 0, status: 'insufficient', pageTypes: [], warnings: error ? [error] : [] },
    speed: null,
    speedMeta: null,
    speedError: null,
    brand: null,
  };
}

/** What one site check returns: the stored evidence, the digest the AI compares, and each read page's full visible text (kept in memory only). */
export interface MeasuredSite {
  evidence: SiteEvidence;
  digest: SiteDigest | null;
  texts: { url: string; text: string }[];
  /** Product / service link labels and headings of every page read (see `siteCatalogue`), for the offers answer. */
  catalogue?: { url: string; text: string }[];
}

/** Visible text of every page read, up to 20,000 characters each: prices and dates often sit below the first screen. */
const FULL_TEXT_CHARS = 20_000;

/**
 * 2 = menu-first page choice with the page kinds of 2026-10-23 and h1/prices per page. Runs before that have no
 * version (version 1); their pages were chosen differently, so page-by-page changes against them are not reported.
 */
export const CRAWL_VERSION = 2;

/** Real visitors' speed from Google's Chrome UX Report (last 28 days, phones), as PageSpeed returns it; not a lab test. */
export interface RealUserSpeed {
  /** url = this home page; origin = the whole website (used when the page alone has too few visitors). */
  scope: 'url' | 'origin';
  overall: MetricCategory | null;
  lcpMs: { p75: number; category: MetricCategory | null } | null;
  inpMs: { p75: number; category: MetricCategory | null } | null;
  cls: { p75: number; category: MetricCategory | null } | null;
}

function realUserSpeed(block: FieldBlock | null): RealUserSpeed | null {
  if (!block) return null;
  const pick = (m: FieldBlock['metrics']['lcpMs']) => (m ? { p75: m.p75, category: m.category } : null);
  const out = { scope: block.scope, overall: block.overallCategory, lcpMs: pick(block.metrics.lcpMs), inpMs: pick(block.metrics.inpMs), cls: pick(block.metrics.cls) };
  return out.lcpMs || out.inpMs || out.cls ? out : null;
}

async function measure(site: { url: string; domain: string; role: 'own' | 'competitor' }, deps: SafeFetchDeps, opts: { pagespeed?: boolean; fetcher?: typeof fetch; renderer?: AnalyzerRenderer | null; preferredPaths?: readonly RegExp[]; journeyRules?: readonly JourneyRule[]; maxPages?:number; businessProfile?:boolean }): Promise<MeasuredSite> {
  const structure = await siteStructure(new URL(site.url).origin, deps);
  const read = await readSite(site.url, deps, opts.maxPages ?? MAX_PAGES_PER_SITE, structure.pages, opts.renderer, opts.preferredPaths);
  if ('error' in read) return { evidence: { ...emptyEvidence(site, read.error), movedTo: read.movedTo ?? null }, digest: null, texts: [] };
  const texts = read.digest.pages.map((p, i) => ({ url: p.url, text: visibleText(read.allHtml[i] ?? '').slice(0, FULL_TEXT_CHARS) }));
  const catalogue = siteCatalogue(read.digest.pages.map((p, i) => ({ url: p.url, html: read.allHtml[i] ?? '' })));
  const pricesOf = (text: string) => [...new Set([...text.matchAll(new RegExp(PRICE.source, 'gi'))].map((m) => m[0].replace(/\s+/g, '').toLowerCase()))].slice(0, 15);

  const home = read.digest.pages[0]!;
  const name = siteName(read.html, home.title);
  const [psi, brand] = await Promise.all([
    opts.pagespeed === false ? Promise.resolve(null) : runPageSpeed(home.url, 'mobile', { apiKey: googleApiKey('pagespeed'), timeoutMs: 90_000, retries: 1, fetcher: opts.fetcher }),
    name ? lookupBrandPresence({ name, website: home.url }, { apiKey: knowledgeGraphApiKey(), fetcher: opts.fetcher }) : Promise.resolve(null),
  ]);
  return {
    digest: read.digest,
    texts,
    catalogue,
    evidence: {
      ...emptyEvidence(site, null),
      reachable: true,
      statedRating: read.allHtml.map((html, i) => statedRating(html, read.digest.pages[i]?.url ?? home.url)).find(Boolean) ?? null,
      name,
      title: home.title || null,
      description: home.description || null,
      image: home.image,
      screenshot: read.screenshot ?? (psi && psi.ok ? psi.audit.screenshot ?? null : null),
      https: home.url.startsWith('https://'),
      pages: read.digest.pages.map((p, i) => ({
        url: p.url, title: p.title, description: p.description, words: p.wordCount, headings: p.headings.length, ctas: p.ctas, kind: p.kind, method: p.method,
        h1: p.headings.find((h) => h.startsWith('H1: '))?.slice(4).trim() || null,
        prices: pricesOf(texts[i]?.text ?? ''),
      })),
      metrics: siteMetrics(read.digest),
      tech: { ...techSignals(read.html, read.homeUrl, read.allHtml), hasBlog: read.features.blog.state === 'present' ? true : read.features.blog.state === 'absent_confirmed' ? false : null, robotsTxt: structure.robotsTxt, sitemapUrls: structure.sitemapUrls, sitemapRecent30: structure.sitemapRecent30, sitemapRecent90: structure.sitemapRecent90, sitemapLatest: structure.sitemapLatest },
      features: read.features,
      journeys: inspectJourneys(read.digest.pages.map((page,index)=>({url:page.url,html:read.allHtml[index]??'',method:page.method})),opts.journeyRules??[]),
      ...(opts.businessProfile?{businessPages:publicObservations(read.digest.pages.map((page,index)=>({url:page.url,html:read.allHtml[index]??'',method:page.method})))}:{}),
      coverage: read.coverage,
      speed: psi && psi.ok ? { ...psi.audit.scores, lcpMs: psi.audit.lab.lcpMs, cls: psi.audit.lab.cls, tbtMs: psi.audit.lab.tbtMs, field: realUserSpeed(psi.audit.field ?? psi.audit.originField) } : null,
      crawlVersion: CRAWL_VERSION,
      speedMeta: psi && psi.ok ? { measuredAt: psi.audit.measuredAt, requestedUrl: psi.audit.requestedUrl, finalUrl: psi.audit.finalUrl, device: 'mobile', lighthouseVersion: psi.audit.lighthouseVersion } : null,
      speedError: psi && !psi.ok ? psi.message : psi === null ? 'Not measured.' : null,
      brand: brand ? { status: brand.status, name: brand.entity?.name ?? null, description: brand.entity?.description ?? null, wikipediaUrl: brand.entity?.wikipediaUrl ?? null } : null,
    },
  };
}

/** Measures one site; gives up after SITE_TIMEOUT_MS so one slow site never stalls the run. */
export async function measureSite(site: { url: string; domain: string; role: 'own' | 'competitor' }, deps: SafeFetchDeps, opts: { pagespeed?: boolean; fetcher?: typeof fetch; timeoutMs?: number; renderer?: AnalyzerRenderer | null; preferredPaths?: readonly RegExp[]; journeyRules?: readonly JourneyRule[]; maxPages?:number; businessProfile?:boolean } = {}): Promise<MeasuredSite> {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<MeasuredSite>((resolve) => {
    timer = setTimeout(() => resolve({ evidence: emptyEvidence(site, 'The site took too long to answer.'), digest: null, texts: [] }), opts.timeoutMs ?? SITE_TIMEOUT_MS);
  });
  try {
    return await Promise.race([measure(site, deps, opts), timeout]);
  } finally {
    clearTimeout(timer);
  }
}
