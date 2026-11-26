/*
 * Google PageSpeed Insights (optional, free API with quotas). Returns lab (Lighthouse) metrics and, when Google has
 * them, real-user field metrics (CrUX) — kept separate. Disabled / failed → explicit state, never zeros.
 */

export interface SpeedMetrics {
  performance: number | null;
  accessibility: number | null;
  seo: number | null;
  bestPractices: number | null;
  lcpMs: number | null;
  cls: number | null;
  tbtMs: number | null;
}

export interface SpeedResult {
  state: "measured" | "disabled" | "provider_unavailable" | "failed";
  requestedUrl: string | null;
  measuredAt: string | null;
  mobile: SpeedMetrics | null;
  /** Real-user (CrUX) data when returned; null otherwise. */
  field: { lcpMs: number | null; cls: number | null; inpMs: number | null; category: string | null } | null;
  lighthouseVersion: string | null;
  /** Home page screenshot from Lighthouse (data:image/jpeg;base64, ≈25 KB); kept in the snapshot, not the report */
  screenshot?: string | null;
  error: string | null;
}

export const speedUnavailable = (state: SpeedResult["state"], error: string | null = null, url: string | null = null): SpeedResult => ({
  state, requestedUrl: url, measuredAt: null, mobile: null, field: null, lighthouseVersion: null, error,
});

type Json = Record<string, any>;
const score = (cats: Json, key: string) => (typeof cats?.[key]?.score === "number" ? Math.round(cats[key].score * 100) : null);
const audit = (audits: Json, key: string) => (typeof audits?.[key]?.numericValue === "number" ? audits[key].numericValue : null);

export function parsePageSpeed(json: Json, url: string, now = new Date()): SpeedResult {
  const lh = json?.lighthouseResult;
  if (!lh) return speedUnavailable("failed", "PageSpeed response had no lighthouseResult.", url);
  const cats = lh.categories ?? {};
  const audits = lh.audits ?? {};
  const fm = json?.loadingExperience?.metrics;
  const lcp = audit(audits, "largest-contentful-paint");
  const cls = audit(audits, "cumulative-layout-shift");
  const tbt = audit(audits, "total-blocking-time");
  return {
    state: "measured",
    requestedUrl: url,
    measuredAt: now.toISOString(),
    mobile: {
      performance: score(cats, "performance"),
      accessibility: score(cats, "accessibility"),
      seo: score(cats, "seo"),
      bestPractices: score(cats, "best-practices"),
      lcpMs: lcp === null ? null : Math.round(lcp),
      cls: cls === null ? null : Math.round(cls * 1000) / 1000,
      tbtMs: tbt === null ? null : Math.round(tbt),
    },
    field: fm
      ? {
          lcpMs: fm.LARGEST_CONTENTFUL_PAINT_MS?.percentile ?? null,
          cls: typeof fm.CUMULATIVE_LAYOUT_SHIFT_SCORE?.percentile === "number" ? fm.CUMULATIVE_LAYOUT_SHIFT_SCORE.percentile / 100 : null,
          inpMs: fm.INTERACTION_TO_NEXT_PAINT?.percentile ?? null,
          category: json.loadingExperience?.overall_category ?? null,
        }
      : null,
    lighthouseVersion: lh.lighthouseVersion ?? null,
    screenshot: typeof audits["final-screenshot"]?.details?.data === "string" && audits["final-screenshot"].details.data.length < 400_000 ? audits["final-screenshot"].details.data : null,
    error: null,
  };
}

export async function measurePageSpeed(url: string, opts: { enabled: boolean; apiKey?: string; fetchImpl?: typeof fetch; timeoutMs?: number }): Promise<SpeedResult> {
  if (!opts.enabled) return speedUnavailable("disabled", "PageSpeed is not enabled (COMPETITOR_PAGESPEED_ENABLED).", url);
  if (process.env.JEST_WORKER_ID && !opts.fetchImpl) return speedUnavailable("disabled", "Live PageSpeed is never called from automated tests.", url);
  const params = new URLSearchParams({ url, strategy: "mobile" });
  for (const c of ["performance", "accessibility", "seo", "best-practices"]) params.append("category", c);
  if (opts.apiKey) params.set("key", opts.apiKey);
  try {
    const res = await (opts.fetchImpl ?? fetch)(`https://www.googleapis.com/pagespeedonline/v5/runPagespeed?${params}`, { signal: AbortSignal.timeout(opts.timeoutMs ?? 90_000) });
    if (res.status === 429) return speedUnavailable("provider_unavailable", "PageSpeed quota exceeded (HTTP 429).", url);
    if (!res.ok) return speedUnavailable("failed", `PageSpeed HTTP ${res.status}.`, url);
    return parsePageSpeed((await res.json()) as Json, url);
  } catch (e) {
    return speedUnavailable("provider_unavailable", (e as Error).message.slice(0, 200), url);
  }
}
