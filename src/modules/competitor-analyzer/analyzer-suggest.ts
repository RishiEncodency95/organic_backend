
export const SUGGEST_PROMPT_VERSION = 'cmp-suggest-2026-10-26.3';
export const MAX_SUGGESTIONS = 8;

export const SUGGEST_SCOPES = ['city', 'state', 'country'] as const;
export type SuggestScope = (typeof SUGGEST_SCOPES)[number];

export interface SuggestInput {
  domain: string;
  title: string;
  description: string;
  headings: string[];
  text: string;
  clues?: string;
  scope: SuggestScope;
  place?: string | null;
}

export interface SuggestCandidate {
  name: string;
  website: string | null;
  why: string;
}

export interface SuggestAnswer {
  business: { what: string; where: string | null };
  area: string | null;
  candidates: SuggestCandidate[];
}

export interface CompetitorSuggestionItem {
  name: string;
  domain: string;
  url: string;
  siteName: string | null;
  why: string;
  source: 'ai' | 'knowledge_graph';
}

export interface SuggestionResult {
  business: { what: string; where: string | null };
  scope: SuggestScope;
  place: string;
  area: string | null;
  suggestions: CompetitorSuggestionItem[];
  dropped: number;
}

export const SUGGEST_SYSTEM = `You help a marketing agency pick competitor websites to compare with a client's website.
You get the client's home page and the area to search. Work out what the business sells, to whom, and where it is based (city, state, country).
The area to search is one of:
- city: businesses based in, or serving customers in, the client's own city (and its suburbs);
- state: businesses anywhere in the client's state or region, not only its city;
- country: the strongest businesses anywhere in the client's country, wherever they are based.
If a location is given, use it instead of the one on the site. If the site does not say where it is, use the most likely location from its address, phone code, language or currency, and say so in "where".
Then name up to ${MAX_SUGGESTIONS + 2} real businesses in that area that compete for the same customers: the same kind of products or services for the same kind of buyer. Put the closest competitors first. Prefer direct competitors with their own website over marketplaces, directories, news sites or social networks.
Rules: only businesses you are confident exist and operate in that area; give a website only when you are confident it is theirs, otherwise null; never invent a domain; never state traffic, revenue, rankings or follower numbers.
Return only a JSON object: {"business": {"what": "one sentence: what the client sells and to whom", "where": "city, state, country or null"}, "area": "the city, state or country searched, e.g. Jaipur, Rajasthan", "competitors": [{"name": "...", "website": "domain.com or null", "why": "one short sentence: why it competes with the client, with its location"}]}`;

const SCOPE_TEXT: Record<SuggestScope, string> = {
  city: "city (the client's own city)",
  state: "state (the client's whole state or region)",
  country: "country (the client's whole country)",
};

export function suggestUserPrompt(input: SuggestInput) {
  return [
    `Client website: ${input.domain}`,
    `Area to search: ${SCOPE_TEXT[input.scope]}`,
    `Location given by the user: ${str(input.place, 120) || '(none, read it from the site)'}`,
    `Title: ${input.title || '(none)'}`,
    `Description: ${input.description || '(none)'}`,
    `Headings: ${input.headings.slice(0, 20).join(' | ') || '(none)'}`,
    `Home page text (start): ${input.text.slice(0, 2500)}`,
    input.clues ? `Location clues:\n${input.clues}` : '',
  ].filter(Boolean).join('\n');
}

export const LOCATION_PROMPT_VERSION = 'cmp-location-2026-10-26.3';
export const MAX_PLACES = 8;

export interface SitePlace {
  label: string;
  city: string | null;
  state: string | null;
  country: string | null;
  quote: string;
}

export interface SiteLocation {
  city: string | null;
  state: string | null;
  country: string | null;
  basis: string;
  places: SitePlace[];
  pages?: string[];
}

export const LOCATION_SYSTEM = `You read what a business's website says about its locations and list them.
You get location clues from the home page and from its contact / about / location pages: structured address data, address tags, embedded maps, the footer, text near words like "venue", "office", "branch", "store", and phone numbers.
List every distinct location the website states (up to ${MAX_PLACES}): event venues, shops, showrooms, branches, clinics, plants, service areas, head and regional offices. For each give a short label as the site words it ("Event venue", "Head office", "Jaipur branch"), the city, the state (or province/region) and the country as plain English names (e.g. "New Delhi", "Delhi", "India"), and "quote": the exact words copied from the clues that show this location (5–25 words, copied character for character).
A service area that names several cities ("serving Delhi • Ghaziabad • Noida") gives one place per city, each labelled "Service area", with its state filled in.
Put first the main place: where the business meets or serves its customers (the event venue of an expo, the shop or showroom, the clinic, the area it serves). A parent or organising company's office is not the main place when the site also states a venue, shop or service area; it is the main place only when it is the business's own and only location.
Rules: only locations written in the clues; never guess a city from the domain ending or a phone code (those may give only the country); use null for any part not shown.
Return only a JSON object: {"places": [{"label": "...", "city": "... or null", "state": "... or null", "country": "... or null", "quote": "..."}], "basis": "one short sentence: why the first place is the main one"}`;

export function locationUserPrompt(input: Omit<SuggestInput, 'scope' | 'place' | 'headings'>) {
  return [
    `Website: ${input.domain}`,
    `Title: ${input.title || '(none)'}`,
    `Description: ${input.description || '(none)'}`,
    input.clues ? `Location clues:\n${input.clues}` : '',
    `Home page text (start): ${input.text.slice(0, 1500)}`,
  ].filter(Boolean).join('\n');
}

const plain = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();

/**
 * Parses the location answer; null when it is not the expected JSON. A place is kept only when its quote, or at least
 * its city, is found in `evidence` (the text the AI was given), so a location the site does not state is dropped.
 */
export function validateLocation(text: string, evidence: string): SiteLocation | null {
  let raw: any;
  try {
    raw = JSON.parse(text);
  } catch {
    return null;
  }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw) || !Array.isArray(raw.places)) return null;
  const part = (v: unknown) => {
    const value = str(v, 80);
    return value && !/^(null|unknown|n\/a|none)$/i.test(value) ? value : null;
  };
  const source = plain(evidence);
  const seen = new Set<string>();
  const places: SitePlace[] = [];
  for (const item of raw.places) {
    const place: SitePlace = { label: str(item?.label, 60) || 'Location', city: part(item?.city), state: part(item?.state), country: part(item?.country), quote: str(item?.quote, 240) };
    if (!place.city && !place.state && !place.country) continue;
    const quoted = place.quote.length >= 8 && source.includes(plain(place.quote));
    const named = [place.city, place.state].some((v) => v && source.includes(plain(v)));
    if (!quoted && !named) continue;
    const key = plain([place.label, place.city, place.state, place.country].join(' '));
    if (seen.has(key)) continue;
    seen.add(key);
    places.push(place);
    if (places.length >= MAX_PLACES) break;
  }
  const main = places[0];
  return { city: main?.city ?? null, state: main?.state ?? null, country: main?.country ?? null, basis: places.length ? str(raw.basis, 200) : '', places };
}

const str = (v: unknown, max: number) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, max) : '');
const FORBIDDEN = /\b(traffic|monthly visits|revenue|turnover|followers|ranks? (#|number|first|1st))\b/i;
const IGNORED_HOSTS = /(^|\.)(facebook|instagram|linkedin|youtube|twitter|x|wikipedia|indiamart|justdial|amazon|flipkart|google|tradeindia|yelp|sulekha)\.[a-z.]+$/i;

/** A bare host from what the AI wrote ("www.Acme.in/about" → "acme.in"); null for anything that is not a plain domain. */
export function domainFrom(value: unknown): string | null {
  const raw = str(value, 200).toLowerCase();
  if (!raw || raw === 'null') return null;
  try {
    const host = new URL(/^https?:\/\//.test(raw) ? raw : `https://${raw}`).hostname.replace(/^www\./, '');
    return /^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(host) ? host : null;
  } catch {
    return null;
  }
}

/** Parses the AI's answer; null when it is not the expected JSON. Marketplaces, social networks and the client itself are removed. */
export function validateSuggest(text: string, ownDomain: string,maxCandidates=MAX_SUGGESTIONS+2): SuggestAnswer | null {
  let raw: any;
  try {
    raw = JSON.parse(text);
  } catch {
    return null;
  }
  if (!raw || typeof raw !== 'object' || !Array.isArray(raw.competitors)) return null;
  const own = ownDomain.replace(/^www\./, '').toLowerCase();
  const seen = new Set<string>();
  const candidates: SuggestCandidate[] = [];
  for (const item of raw.competitors) {
    const name = str(item?.name, 120);
    if (!name || FORBIDDEN.test(name) || seen.has(name.toLowerCase())) continue;
    let website = domainFrom(item?.website);
    if (website && (website === own || website.endsWith(`.${own}`) || IGNORED_HOSTS.test(website))) website = null;
    // The client itself, named instead of linked ("Bharat Organic Expo" for bharatorganicexpo.com).
    const brand = own.split('.')[0]!.replace(/[^a-z0-9]/g, '');
    if (!website && brand.length >= 4 && name.toLowerCase().replace(/[^a-z0-9]/g, '').includes(brand)) continue;
    const why = str(item?.why, 200);
    seen.add(name.toLowerCase());
    candidates.push({ name, website, why: FORBIDDEN.test(why) ? '' : why });
    if (candidates.length >= Math.min(24,maxCandidates)) break;
  }
  return { business: { what: str(raw.business?.what, 240), where: str(raw.business?.where, 120) || null }, area: str(raw.area, 120) || null, candidates };
}

const WEAK_WORDS = new Set([
  'the', 'and', 'for', 'our', 'india', 'indian', 'pvt', 'private', 'ltd', 'limited', 'llp', 'inc', 'company', 'group', 'international', 'global',
  'design', 'designs', 'designer', 'designers', 'interior', 'interiors', 'studio', 'studios', 'architect', 'architects', 'associates', 'solutions',
  'services', 'consultants', 'enterprises', 'industries', 'expo', 'expos', 'exhibition', 'exhibitions', 'events', 'foundation', 'trust', 'official', 'online',
]);
const nameWords = (s: string) => s.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, ' ').split(' ').filter((w) => w.length >= 2);

export function nameMatchesSite(name: string, domain: string, siteName?: string | null) {
  const all = nameWords(name);
  if (!all.length) return false;
  const labels = domain.toLowerCase().replace(/^www\./, '').split('.');
  const host = labels.filter((l, i) => i < labels.length - 1 && !['co', 'com', 'org', 'net', 'gov', 'ac', 'edu'].includes(l)).join('');
  const hay = `${host} ${nameWords(siteName ?? '').join('')}`;
  const strong = all.filter((w) => w.length >= 3 && !WEAK_WORDS.has(w));
  return strong.length ? strong.some((w) => hay.includes(w)) : hay.includes(all.join(''));
}

export function isIgnoredHost(domain: string) {
  return IGNORED_HOSTS.test(domain);
}
