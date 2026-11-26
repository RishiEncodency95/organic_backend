/*
 * Google Search Console API (own verified property only). Read-only.
 * These are MEASURED values for our own site: clicks, impressions, CTR and average position from Google.
 * Impressions are not "search volume" and nothing here is available for competitor sites.
 */

const BASE = "https://searchconsole.googleapis.com/webmasters/v3";
type FetchLike = typeof fetch;

export interface GscSite {
  siteUrl: string;
  permissionLevel: string;
}

export interface GscRow {
  key: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

export interface GscSummary {
  state: "measured" | "not_connected" | "no_property" | "failed";
  property: string | null;
  period: { start: string; end: string } | null;
  totals: { clicks: number; impressions: number; ctr: number | null; position: number | null } | null;
  queries: GscRow[];
  pages: GscRow[];
  measuredAt: string | null;
  error: string | null;
}

export const gscUnavailable = (state: GscSummary["state"], error: string | null = null, property: string | null = null): GscSummary => ({
  state, property, period: null, totals: null, queries: [], pages: [], measuredAt: null, error,
});

async function call(token: string, path: string, init: RequestInit = {}, fetchImpl: FetchLike = fetch) {
  const res = await fetchImpl(`${BASE}${path}`, {
    ...init,
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json", ...(init.headers ?? {}) },
    signal: AbortSignal.timeout(30_000),
  });
  const j: any = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`Search Console HTTP ${res.status}: ${j?.error?.message ?? "error"}`);
  return j;
}

export async function listSites(token: string, fetchImpl: FetchLike = fetch): Promise<GscSite[]> {
  const j = await call(token, "/sites", {}, fetchImpl);
  return (j.siteEntry ?? []).map((s: any) => ({ siteUrl: String(s.siteUrl), permissionLevel: String(s.permissionLevel) }));
}

/** Search Console data is final ~3 days later: [end-27, end] with end = today-3 (UTC dates). */
export function gscPeriod(now = new Date(), days = 28) {
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 3));
  const start = new Date(end.getTime() - (days - 1) * 86_400_000);
  const f = (d: Date) => d.toISOString().slice(0, 10);
  return { start: f(start), end: f(end) };
}

const rows = (j: any): GscRow[] =>
  (j.rows ?? []).map((r: any) => ({ key: String(r.keys?.[0] ?? ""), clicks: Number(r.clicks ?? 0), impressions: Number(r.impressions ?? 0), ctr: Math.round(Number(r.ctr ?? 0) * 10_000) / 10_000, position: Math.round(Number(r.position ?? 0) * 10) / 10 }));

export async function fetchSummary(token: string, property: string, opts: { now?: Date; rowLimit?: number; fetchImpl?: FetchLike } = {}): Promise<GscSummary> {
  const period = gscPeriod(opts.now);
  const path = `/sites/${encodeURIComponent(property)}/searchAnalytics/query`;
  const body = (dimensions: string[]) => JSON.stringify({ startDate: period.start, endDate: period.end, dimensions, rowLimit: opts.rowLimit ?? 500, dataState: "final" });
  const [q, p, t] = await Promise.all([
    call(token, path, { method: "POST", body: body(["query"]) }, opts.fetchImpl),
    call(token, path, { method: "POST", body: body(["page"]) }, opts.fetchImpl),
    call(token, path, { method: "POST", body: body([]) }, opts.fetchImpl),
  ]);
  const total = (t.rows ?? [])[0];
  return {
    state: "measured",
    property,
    period,
    totals: total ? { clicks: total.clicks, impressions: total.impressions, ctr: Math.round(total.ctr * 10_000) / 10_000, position: Math.round(total.position * 10) / 10 } : { clicks: 0, impressions: 0, ctr: null, position: null },
    queries: rows(q),
    pages: rows(p),
    measuredAt: new Date().toISOString(),
    error: null,
  };
}
