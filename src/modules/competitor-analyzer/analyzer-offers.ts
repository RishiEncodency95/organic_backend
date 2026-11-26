
import { visibleText } from '../website-intelligence/competitor-ai';

export const OFFERS_PROMPT_VERSION = 'cmp-offers-2026-10-26.3';
export const MAX_CATALOGUE_ITEMS = 15;

export const OFFER_FIELDS = ['eventName', 'dates', 'location', 'exhibitors', 'visitors', 'stallPrice', 'ticketPrice', 'deadline'] as const;
export type OfferField = (typeof OFFER_FIELDS)[number];

export interface OfferFact {
  value: string;
  url: string;
  quote: string;
}
export interface LabeledFact extends OfferFact {
  label: string;
}

export type SiteOffers = { domain: string; products?: OfferFact[]; services?: OfferFact[]; prices: LabeledFact[]; claims: LabeledFact[] } & Record<OfferField, OfferFact | null>;

export interface OffersBlock {
  status: 'completed' | 'failed';
  promptVersion: string;
  generatedAt: string;
  sites: SiteOffers[];
  dropped: number;
  reason?: string;
}

export interface PageText {
  url: string;
  text: string;
}

const KEYWORDS =
  /stall|booth|shell scheme|raw space|sq\.?\s?m|sqm|square met|price|pricing|tariff|fee|₹|\brs\.?\s?\d|\binr\b|\busd\b|\$\s?\d|package|sponsor|ticket|entry|admission|register|registration|exhibitor|visitor|footfall|delegate|buyer|edition|venue|hall|expo|exhibition|conference|summit|fair|deadline|last date|early bird|\b20\d\d\b|\b\d{1,2}(st|nd|rd|th)?\s*(-|–|to)\s*\d{1,2}(st|nd|rd|th)?\b/gi;
const WINDOW = 220;
const SITE_CHARS = 4500;

/** Excerpts around offer and event words: windows of ±220 characters, merged, at most 4,500 characters per site. */
export function offerSnippets(pages: PageText[], maxChars = SITE_CHARS): PageText[] {
  const out: PageText[] = [];
  let used = 0;
  for (const page of pages) {
    if (used >= maxChars) break;
    const ranges: [number, number][] = [];
    for (const m of page.text.matchAll(KEYWORDS)) {
      const start = Math.max(0, (m.index ?? 0) - WINDOW);
      const end = Math.min(page.text.length, (m.index ?? 0) + m[0].length + WINDOW);
      const last = ranges[ranges.length - 1];
      if (last && start <= last[1]) last[1] = Math.max(last[1], end);
      else ranges.push([start, end]);
    }
    if (!ranges.length) continue;
    const text = ranges.map(([s, e]) => page.text.slice(s, e).trim()).join(' … ').slice(0, maxChars - used);
    used += text.length;
    out.push({ url: page.url, text });
  }
  return out;
}

/** Links into a site's catalogue: product, service, solution, category, treatment, course or package pages. */
const CATALOGUE_HREF = /\/(products?|services?|solutions?|categor(y|ies)|collections?|shop|store|treatments?|therap(y|ies)|courses?|programs?|programmes?|packages?|catalog(ue)?|range|offerings?|what-we-do|our-work|setups?|equipments?|machines?)(\/|$|[-_.])/i;
/** Button words around a name ("… Explore Now") and labels that are not names at all. */
const BUTTON_WORDS = /\b(explore now|read more|view details|view more|learn more|know more|shop now|buy now|enquire now|get (a )?quote|click here|order now|book now)\b/gi;
const NOT_A_NAME = /^((explore|view|show|see|browse|discover) .*|products?|services?|solutions?|shop|store|home|all|more|show more|view all|categories|our products|our services|our solutions|e-?brochure|brochure|download)$/i;
const CATALOGUE_CHARS = 3_000;

/**
 * The names a page gives its products and services: the labels of links into its catalogue and its h2–h4 headings,
 * each as plain visible text (so a quote of a name is found in the page text). At most 3,000 characters per page.
 */
export function catalogueText(html: string, pageUrl: string): string {
  let base: URL;
  try {
    base = new URL(pageUrl);
  } catch {
    return '';
  }
  const host = base.hostname.replace(/^www\./, '');
  const clean = (s: string) => visibleText(s).replace(BUTTON_WORDS, ' ').replace(/\s+/g, ' ').trim();
  const links = new Set<string>();
  for (const m of html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)) {
    const href = /href\s*=\s*["']([^"'#]+)["']/i.exec(m[1]!)?.[1];
    if (!href) continue;
    try {
      const u = new URL(href, base);
      if (u.hostname.replace(/^www\./, '') !== host || !CATALOGUE_HREF.test(u.pathname) || /\.(pdf|jpe?g|png|webp|zip)$/i.test(u.pathname)) continue;
    } catch {
      continue;
    }
    const label = clean(m[2]!);
    if (label.length >= 3 && label.length <= 100 && !NOT_A_NAME.test(label)) links.add(label);
  }
  const headings = new Set<string>();
  for (const m of html.matchAll(/<h([2-4])\b[^>]*>([\s\S]*?)<\/h\1>/gi)) {
    const t = clean(m[2]!);
    if (t.length >= 3 && t.length <= 100) headings.add(t);
  }
  const parts = [links.size ? `Product / service links: ${[...links].join(' | ')}` : '', headings.size ? `Headings: ${[...headings].join(' | ')}` : ''].filter(Boolean);
  return parts.join('\n').slice(0, CATALOGUE_CHARS);
}

/** `catalogueText` for each page read, home first, at most 6,000 characters per site. */
export function siteCatalogue(pages: { url: string; html: string }[], maxChars = 6_000): PageText[] {
  const out: PageText[] = [];
  let used = 0;
  for (const page of pages) {
    if (used >= maxChars) break;
    const text = catalogueText(page.html, page.url).slice(0, maxChars - used);
    if (!text) continue;
    used += text.length;
    out.push({ url: page.url, text });
  }
  return out;
}

export const OFFERS_SYSTEM = `You read excerpts from websites and pull out only facts the website itself states about what it sells, its events and its offers.
For every fact give: "value" (short, as written, e.g. "12-14 February 2027", "₹45,000 per 9 sqm stall"), "url" (the excerpt's url) and "quote" (copied word for word from that excerpt, at most 160 characters, containing the value).
Never guess, combine pages, convert currencies or round numbers. If a fact is not written in the excerpts, use null.
"products": the named products or product ranges the site sells (machines, equipment, food items, software…), max ${MAX_CATALOGUE_ITEMS}; "services": the named services, solutions, setups, treatments, courses or packages it offers, max ${MAX_CATALOGUE_ITEMS}. Each is {"value": the name as written, "url", "quote"}; the quote must contain the name itself (the link label or heading is a fine quote), not a general sentence about the business. List individually named products (e.g. "Shirodhara Therapy Table") before category names (e.g. "Massage & Treatment Tables"). Take them from product / service links, headings and the text; skip blog titles, slogans ("Wellness Spaces That Heal"), section titles ("Quick Links", "Contact Us") and generic words. An expo or event site lists its exhibitor or product categories here only when it names them.
Event fields, each a fact {"value","url","quote"} or null: eventName, dates (event dates), location (city and/or venue), exhibitors (number of exhibitors or brands), visitors (number of visitors, buyers or delegates), stallPrice (stall, booth or space price), ticketPrice (entry, ticket or delegate fee), deadline (registration or booking deadline). Read every site with the same care: a site later in the list gets its event fields filled just like the first one.
Also "prices": other priced offers or packages [{"label","value","url","quote"}] (max 6), and "claims": other numbers the site claims about itself, e.g. years running, countries, products [{"label","value","url","quote"}] (max 6).
A missing fact is null, never {} or a fact with empty parts.
Return only JSON, one entry per domain given:
{"sites": [{"domain": "...", "products": [{"value": "...", "url": "...", "quote": "..."}], "services": [{"value": "...", "url": "...", "quote": "..."}], "eventName": {"value": "...", "url": "...", "quote": "..."} or null, "dates": {…} or null, "location": {…} or null, "exhibitors": {…} or null, "visitors": {…} or null, "stallPrice": {…} or null, "ticketPrice": {…} or null, "deadline": {…} or null, "prices": [{"label": "...", "value": "...", "url": "...", "quote": "..."}], "claims": [{"label": "...", "value": "...", "url": "...", "quote": "..."}]}]}`;

export function offersUserPrompt(sites: { domain: string; excerpts: PageText[] }[]) {
  return sites
    .map((s) => [`### ${s.domain}`, ...(s.excerpts.length ? s.excerpts.map((e) => `[${e.url}]\n${e.text}`) : ['(no excerpts about products, events or offers)'])].join('\n'))
    .join('\n\n');
}

const norm = (s: string) => s.toLowerCase().replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/[–—]/g, '-').replace(/\s+/g, ' ').trim();
const str = (v: unknown, max: number) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, max) : '');
const domainOf = (v: unknown) => str(v, 200).toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/.*$/, '');


function checkFact(raw: unknown, pages: Map<string, string>): OfferFact | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const value = str(r.value, 120);
  const url = str(r.url, 500);
  const quote = str(r.quote, 200);
  const page = pages.get(url);
  if (!value || !quote || page === undefined) return null;
  if (!norm(page).includes(norm(quote))) return null;
  const digits = value.match(/\d[\d,.]*/g) ?? [];
  const q = norm(quote).replace(/,/g, '');
  if (!digits.every((d) => q.includes(d.replace(/,/g, '').replace(/\.$/, '')))) return null;
  if (digits.length && digits.every((d) => /^[0.,]+$/.test(d)) && /^\D{0,3}[\d.,]+\s*[+%]?\D{0,3}$/.test(value)) return null;
  return { value, url, quote };
}

export function validateOffers(text: string, sites: { domain: string; pages: PageText[] }[]): { sites: SiteOffers[]; dropped: number } | null {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return null;
  }
  const list = (raw as { sites?: unknown })?.sites;
  if (!Array.isArray(list)) return null;
  let dropped = 0;
  const out = sites.map((site) => {
    const pages = new Map(site.pages.map((p) => [p.url, p.text]));
    const entry = (list.find((x) => domainOf((x as { domain?: unknown })?.domain) === site.domain) ?? {}) as Record<string, unknown>;
    const fact = (v: unknown) => {
      const blank = v != null && typeof v === 'object' && !Array.isArray(v) && Object.values(v).every((x) => x == null || x === '');
      if (v == null || blank) return null;
      const ok = checkFact(v, pages);
      if (!ok) dropped += 1;
      return ok;
    };
    const labeled = (v: unknown, max: number): LabeledFact[] =>
      (Array.isArray(v) ? v : []).slice(0, max).flatMap((item) => {
        const ok = fact(item);
        const label = str((item as { label?: unknown })?.label, 60);
        return ok && label ? [{ ...ok, label }] : [];
      });
    const pageWith = (item: unknown) => {
      const quote = norm(str((item as { quote?: unknown })?.quote, 200));
      return quote ? site.pages.find((p) => norm(p.text).includes(quote))?.url : undefined;
    };
    const nameOnSite = (item: unknown): OfferFact | null => {
      const value = str((item as { value?: unknown })?.value, 120);
      if (value.length < 3) return null;
      const page = site.pages.find((p) => norm(p.text).includes(norm(value)));
      return page ? { value, url: page.url, quote: value } : null;
    };
    const names = (v: unknown): OfferFact[] => {
      const seen = new Set<string>();
      return (Array.isArray(v) ? v : []).slice(0, MAX_CATALOGUE_ITEMS + 6).flatMap((item) => {
        if (item == null) return [];
        let ok = checkFact(item, pages);
        if (!ok) {
          const url = pageWith(item);
          ok = url ? checkFact({ ...(item as object), url }, pages) : null;
        }
        if (!ok || !norm(ok.quote).includes(norm(ok.value))) ok = nameOnSite(item);
        if (!ok) {
          dropped += 1;
          return [];
        }
        const key = norm(ok.value).replace(/&/g, ' and ').split(/[^\p{L}\p{N}]+/u).filter(Boolean).map((w) => w.replace(/s$/, '')).join(' ');
        if (seen.has(key)) return [];
        seen.add(key);
        return [ok];
      }).slice(0, MAX_CATALOGUE_ITEMS);
    };
    const fields = Object.fromEntries(OFFER_FIELDS.map((f) => [f, fact(entry[f])])) as Record<OfferField, OfferFact | null>;
    return { domain: site.domain, products: names(entry.products), services: names(entry.services), ...fields, prices: labeled(entry.prices, 6), claims: labeled(entry.claims, 6) };
  });
  return { sites: out, dropped };
}

export function emptyOffers(domain: string): SiteOffers {
  return { domain, products: [], services: [], ...(Object.fromEntries(OFFER_FIELDS.map((f) => [f, null])) as Record<OfferField, null>), prices: [], claims: [] };
}

export function hasOffers(s: SiteOffers) {
  return OFFER_FIELDS.some((f) => s[f]) || s.prices.length > 0 || s.claims.length > 0 || Boolean(s.products?.length) || Boolean(s.services?.length);
}
