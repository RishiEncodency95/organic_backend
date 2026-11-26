import { domainOf } from "../crawler/url";

/*
 * "Does Google know the brand?" via the Google Knowledge Graph Search API (free, API key).
 *   matched   – an entity whose url is on this domain
 *   possible  – an entity with the same name but no matching url (could be another business)
 *   not_found – the API answered with nothing relevant
 *   unavailable – API disabled / key restricted / error (never shown as "not known")
 * This is a presence signal only: never a ranking, trust or quality claim.
 */

export interface BrandPresence {
  state: "matched" | "possible" | "not_found" | "unavailable";
  name: string | null;
  description: string | null;
  types: string[];
  url: string | null;
  wikipediaUrl: string | null;
  error: string | null;
  checkedAt: string;
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9ऀ-ॿ]+/g, " ").trim();

export function interpretKg(json: any, query: string, domain: string, now = new Date()): BrandPresence {
  const base = { name: null, description: null, types: [], url: null, wikipediaUrl: null, error: null, checkedAt: now.toISOString() };
  const items: any[] = Array.isArray(json?.itemListElement) ? json.itemListElement : [];
  const results = items.map((i) => i?.result).filter(Boolean);
  const pick = (r: any, state: BrandPresence["state"]): BrandPresence => ({
    ...base,
    state,
    name: typeof r.name === "string" ? r.name : null,
    description: typeof r.description === "string" ? r.description : null,
    types: Array.isArray(r["@type"]) ? r["@type"].slice(0, 6) : [],
    url: typeof r.url === "string" ? r.url : null,
    wikipediaUrl: typeof r.detailedDescription?.url === "string" ? r.detailedDescription.url : null,
  });
  const onDomain = results.find((r) => typeof r.url === "string" && domainOf(r.url) === domain);
  if (onDomain) return pick(onDomain, "matched");
  const sameName = results.find((r) => typeof r.name === "string" && norm(r.name) === norm(query));
  if (sameName) return pick(sameName, "possible");
  return { ...base, state: "not_found" };
}

export async function brandPresence(siteName: string | null, domain: string, opts: { apiKey?: string; fetchImpl?: typeof fetch } = {}): Promise<BrandPresence> {
  const now = new Date();
  const unavailable = (error: string): BrandPresence => ({ state: "unavailable", name: null, description: null, types: [], url: null, wikipediaUrl: null, error, checkedAt: now.toISOString() });
  if (!opts.apiKey) return unavailable("No Google API key configured (GOOGLE_API_KEY / PAGESPEED_API_KEY).");
  if (process.env.JEST_WORKER_ID && !opts.fetchImpl) return unavailable("Live Google calls are never made from automated tests.");
  const query = siteName?.trim() || domain;
  try {
    const res = await (opts.fetchImpl ?? fetch)(`https://kgsearch.googleapis.com/v1/entities:search?${new URLSearchParams({ query, key: opts.apiKey, limit: "5", languages: "en" })}`, { signal: AbortSignal.timeout(15_000) });
    const json: any = await res.json().catch(() => ({}));
    if (!res.ok) return unavailable(res.status === 403 ? "Knowledge Graph Search API is not enabled for this key (enable it in Google Cloud and allow it in the key's API restrictions)." : `Knowledge Graph HTTP ${res.status}`);
    return interpretKg(json, query, domain, now);
  } catch (e) {
    return unavailable((e as Error).message.slice(0, 200));
  }
}
