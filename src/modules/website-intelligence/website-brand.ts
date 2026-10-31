/**
 * Brand presence in Google's Knowledge Graph (Knowledge Graph Search API).
 *
 * The API answers "which entities does Google know by this name". A business that has an entity is the kind of business
 * Google can show a Knowledge Panel for; one without is not. The API does not tell us whether a panel is shown for a given
 * search, so the result is worded as "Google knows / does not know this business", never as "a panel is shown".
 *
 * Matching is deliberately strict: an entity counts as the client only when its official website is the client's domain.
 * A same-name entity without that link is reported as a possible match for a person to judge, never as a confirmed one.
 */

import { classifyGoogleError, googleFetch, type GoogleFailure } from './website-google';

const KG_ENDPOINT = 'https://kgsearch.googleapis.com/v1/entities:search';
/** Without a type filter the API returns nothing for many organisations, so the search is limited to business-like types. */
const KG_TYPES = ['Organization', 'Corporation', 'LocalBusiness', 'GovernmentOrganization', 'EducationalOrganization', 'Brand'] as const;
const TIMEOUT_MS = 10_000;

export type BrandPresenceStatus = 'matched' | 'possible' | 'not_found' | 'unavailable';

export interface BrandEntity {
  id: string;
  name: string;
  types: string[];
  description: string | null;
  url: string | null;
  wikipediaUrl: string | null;
  summary: string | null;
  imageUrl: string | null;
  score: number;
}

export interface BrandPresence {
  status: BrandPresenceStatus;
  query: string;
  websiteHost: string | null;
  checkedAt: string;
  /** The entity that is the client (matched) or that might be (possible). */
  entity: BrandEntity | null;
  /** Other same-name entities Google returned, for context. */
  others: BrandEntity[];
  failure: { code: string; message: string } | null;
}

/** The key: a dedicated one if set, otherwise the PageSpeed key (one Google Cloud project usually holds both APIs). */
export function knowledgeGraphApiKey(env: NodeJS.ProcessEnv = process.env): string | null {
  const key = env.GOOGLE_KNOWLEDGE_GRAPH_API_KEY || env.PAGESPEED_API_KEY;
  return key && key.trim() ? key.trim() : null;
}

export function hostOf(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(/^https?:\/\//i.test(url) ? url : `https://${url}`);
    return parsed.hostname.toLowerCase().replace(/^www\./, '') || null;
  } catch {
    return null;
  }
}

/** Case, punctuation and common legal suffixes do not make two names different. */
export function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/&/g, ' and ')
    .replace(/\b(pvt|private|ltd|limited|llp|inc|co|company|the)\b/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function toEntity(item: any): BrandEntity | null {
  const result = item?.result;
  if (!result || typeof result.name !== 'string') return null;
  const types = Array.isArray(result['@type']) ? result['@type'].filter((t: unknown) => typeof t === 'string' && t !== 'Thing') : [];
  return {
    id: String(result['@id'] ?? '').replace(/^kg:/, ''),
    name: result.name,
    types,
    description: typeof result.description === 'string' ? result.description : null,
    url: typeof result.url === 'string' ? result.url : null,
    wikipediaUrl: typeof result.detailedDescription?.url === 'string' ? result.detailedDescription.url : null,
    summary: typeof result.detailedDescription?.articleBody === 'string' ? result.detailedDescription.articleBody : null,
    imageUrl: typeof result.image?.contentUrl === 'string' ? result.image.contentUrl : null,
    score: Number.isFinite(item.resultScore) ? Math.round(item.resultScore) : 0,
  };
}

/** Decides which returned entity, if any, is the client. Pure, so it is tested without the network. */
export function classifyEntities(query: string, websiteHost: string | null, entities: BrandEntity[]): Pick<BrandPresence, 'status' | 'entity' | 'others'> {
  const byWebsite = websiteHost ? entities.find((e) => hostOf(e.url) === websiteHost) : undefined;
  if (byWebsite) return { status: 'matched', entity: byWebsite, others: entities.filter((e) => e !== byWebsite) };
  const wanted = normalizeName(query);
  const byName = entities.find((e) => normalizeName(e.name) === wanted);
  if (byName) return { status: 'possible', entity: byName, others: entities.filter((e) => e !== byName) };
  return { status: 'not_found', entity: null, others: entities };
}

/** Free-text Knowledge Graph search: the entities Google knows by this name. Used by the client card and the business lookup. */
export async function searchEntities(
  query: string,
  options: { apiKey: string | null; fetcher?: typeof fetch; endpoint?: string },
): Promise<{ ok: true; entities: BrandEntity[] } | { ok: false; failure: { code: string; message: string } }> {
  if (!options.apiKey) {
    return { ok: false, failure: { code: 'not_configured', message: 'No Google API key is configured for the Knowledge Graph Search API (GOOGLE_KNOWLEDGE_GRAPH_API_KEY or PAGESPEED_API_KEY).' } };
  }
  const url = new URL(options.endpoint ?? KG_ENDPOINT);
  url.searchParams.set('query', query);
  url.searchParams.set('limit', '5');
  for (const type of KG_TYPES) url.searchParams.append('types', type);
  url.searchParams.set('key', options.apiKey);

  const response = await googleFetch(url.toString(), { method: 'GET' }, TIMEOUT_MS, options.fetcher);
  if (!response.ok) return { ok: false, failure: { code: response.code, message: response.message } };
  if (!response.httpOk) {
    const failure: GoogleFailure = classifyGoogleError('Knowledge Graph Search', response.status, response.body);
    return { ok: false, failure: { code: failure.code, message: failure.message } };
  }
  const entities = (Array.isArray(response.body?.itemListElement) ? response.body.itemListElement : [])
    .map(toEntity)
    .filter((entity: BrandEntity | null): entity is BrandEntity => entity !== null);
  return { ok: true, entities };
}

export async function lookupBrandPresence(
  input: { name: string; website: string | null },
  options: { apiKey: string | null; fetcher?: typeof fetch; now?: Date; endpoint?: string },
): Promise<BrandPresence> {
  const query = input.name.trim();
  const websiteHost = hostOf(input.website);
  const base = { query, websiteHost, checkedAt: (options.now ?? new Date()).toISOString(), entity: null, others: [] as BrandEntity[] };
  const result = await searchEntities(query, options);
  if (!result.ok) return { ...base, status: 'unavailable', failure: result.failure };
  return { ...base, ...classifyEntities(query, websiteHost, result.entities), failure: null };
}
