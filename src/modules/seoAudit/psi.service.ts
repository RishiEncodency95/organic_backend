/**
 * Real Google PageSpeed Insights (Lighthouse) integration.
 *
 * Calls Google's public PSI endpoint for one URL + strategy and maps the
 * lighthouseResult audits onto a flat snapshot. There is NO synthetic
 * fallback here: when Google does not return a score the field is null and
 * the report shows the check as "not available" — never a fabricated number.
 */

import type { PageSpeedSnapshot } from "./types";

const PSI_ENDPOINT = "https://www.googleapis.com/pagespeedonline/v5/runPagespeed";
const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours, mirrors Google's own cadence

const cache = new Map<string, { at: number; payload: PageSpeedSnapshot }>();

function num(audit: unknown): number | null {
  const value = (audit as { numericValue?: number } | undefined)?.numericValue;
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function scoreOf(categories: Record<string, { score?: number | null }> | undefined, key: string): number | null {
  const score = categories?.[key]?.score;
  return typeof score === "number" ? Math.round(score * 100) : null;
}

/**
 * What is returned when Google PageSpeed could not be asked or did not answer: no run, no numbers. Every score and
 * metric is null and `ok` is false, so the report says "not measured" instead of showing invented values.
 */
export function noPageSpeed(url: string, strategy: "mobile" | "desktop", message: string): PageSpeedSnapshot {
  return {
    ok: false,
    message,
    url,
    strategy,
    fetchedAt: new Date().toISOString(),
    cached: false,
    scores: { performance: null, accessibility: null, bestPractices: null, seo: null },
    metrics: {
      fcpMs: null, lcpMs: null, tbtMs: null, ttiMs: null, cls: null, siMs: null, ttfbMs: null, htmlKb: null, payloadKb: null,
      totalRequests: null, domNodes: null, imageRequests: null, javascriptKb: null, cssKb: null, fontKb: null, otherKb: null,
    },
    fieldData: { available: false, overall: null },
  };
}

const unavailable = noPageSpeed;

type Row = Record<string, unknown>;
const rowsOf = (audit: unknown): Row[] => {
  const items = (audit as { details?: { items?: unknown[] } } | undefined)?.details?.items;
  return Array.isArray(items) ? (items as Row[]) : [];
};
const shortUrl = (u: unknown): string => {
  const s = String(u ?? "");
  try {
    const p = new URL(s);
    return `${p.hostname}${p.pathname}`.slice(0, 120);
  } catch {
    return s.slice(0, 120);
  }
};

/**
 * The causes Lighthouse found, read from the same run (Lighthouse 12 audit ids and the newer "insight" ids). Only what
 * Google returned is used; anything missing stays empty.
 */
function readDiagnostics(audits: Record<string, unknown>, pageUrl: string): NonNullable<PageSpeedSnapshot["diagnostics"]> {
  // LCP: the element and the four parts of its time
  let lcpElement: string | null = null;
  let lcpBreakdown: Array<{ label: string; ms: number }> = [];
  for (const part of rowsOf(audits["lcp-breakdown-insight"] ?? audits["largest-contentful-paint-element"])) {
    const p = part as { type?: string; items?: Row[]; nodeLabel?: string; snippet?: string; node?: { nodeLabel?: string; snippet?: string } };
    if (p.nodeLabel || p.snippet) lcpElement = String(p.nodeLabel || p.snippet).slice(0, 200);
    for (const it of p.items ?? []) {
      const node = (it as { node?: { nodeLabel?: string; snippet?: string } }).node;
      if (node && !lcpElement) lcpElement = String(node.nodeLabel || node.snippet || "").slice(0, 200) || null;
      const label = (it as { label?: string; phase?: string }).label ?? (it as { phase?: string }).phase;
      const ms = Number((it as { duration?: number; timing?: number }).duration ?? (it as { timing?: number }).timing);
      if (label && Number.isFinite(ms)) lcpBreakdown.push({ label: String(label), ms: Math.round(ms) });
    }
  }
  lcpBreakdown = lcpBreakdown.slice(0, 6);

  const renderBlocking = rowsOf(audits["render-blocking-insight"] ?? audits["render-blocking-resources"])
    .map((r) => ({ url: shortUrl(r.url), ms: Math.round(Number(r.wastedMs) || 0) }))
    .filter((r) => r.url && r.ms > 0)
    .sort((a, b) => b.ms - a.ms)
    .slice(0, 6);

  const unusedJs = rowsOf(audits["unused-javascript"])
    .map((r) => ({ url: shortUrl(r.url), kb: Math.round((Number(r.wastedBytes) || 0) / 1024) }))
    .filter((r) => r.url && r.kb > 0)
    .sort((a, b) => b.kb - a.kb)
    .slice(0, 6);

  const scriptCpu = rowsOf(audits["bootup-time"])
    .filter((r) => r.url && r.url !== "Unattributable" && String(r.url).split("#")[0] !== pageUrl.split("#")[0])
    .map((r) => ({ url: shortUrl(r.url), ms: Math.round(Number(r.scripting ?? r.total) || 0) }))
    .filter((r) => r.ms > 0)
    .sort((a, b) => b.ms - a.ms)
    .slice(0, 6);

  return { lcpElement, lcpBreakdown, renderBlocking, unusedJs, scriptCpu };
}

/** Runs a real Lighthouse pass via Google's PageSpeed Insights API. */
export async function runPageSpeed(
  url: string,
  strategy: "mobile" | "desktop" = "mobile",
  refresh = false,
): Promise<PageSpeedSnapshot> {
  const cacheKey = `${strategy}:${url}`;
  const hit = cache.get(cacheKey);
  if (!refresh && hit && Date.now() - hit.at < CACHE_TTL_MS) {
    return { ...hit.payload, cached: true };
  }

  const params = new URLSearchParams({ url, strategy, source: "seo-audit-admin" });
  ["performance", "accessibility", "best-practices", "seo"].forEach((category) =>
    params.append("category", category),
  );
  const key = process.env.PAGESPEED_API_KEY || process.env.PSI_API_KEY;
  if (key) params.set("key", key);

  try {
    // Google sometimes answers 429 (quota burst) or 500/503 (its Lighthouse run timed out): ask again a couple of
    // times. Only a real answer from Google is ever shown; if it never comes the check says "not measured".
    let response: Response | null = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      response = await fetch(`${PSI_ENDPOINT}?${params.toString()}`, {
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(120_000),
      });
      if (response.ok || ![429, 500, 502, 503, 504].includes(response.status) || attempt === 2) break;
      await new Promise((resolve) => setTimeout(resolve, 4000 * (attempt + 1)));
    }

    if (!response || !response.ok) {
      const status = response?.status ?? 0;
      const detail = await response?.text().catch(() => "");
      const reason =
        status === 429
          ? "Google PageSpeed quota is used up for now; try again in a few minutes"
          : `Google PageSpeed could not measure this page (HTTP ${status}${detail ? `: ${detail.replace(/\s+/g, " ").slice(0, 160)}` : ""})`;
      return unavailable(url, strategy, reason);
    }

    const raw = (await response.json()) as {
      lighthouseResult?: {
        categories?: Record<string, { score?: number | null }>;
        audits?: Record<string, unknown>;
      };
      loadingExperience?: { overall_category?: string; metrics?: Record<string, unknown>; initial_record?: { metrics?: Record<string, unknown> } };
    };

    const categories = raw.lighthouseResult?.categories;
    const audits = raw.lighthouseResult?.audits || {};
    if (!categories) {
      return unavailable(url, strategy, "PageSpeed Insights returned no lighthouseResult for this URL");
    }

    const fieldMetrics = (raw.loadingExperience as any)?.metrics || raw.loadingExperience?.initial_record?.metrics;
    const hasFieldData = Boolean(fieldMetrics && Object.keys(fieldMetrics).length > 0);

    type ResourceRow = { resourceType?: string; requestCount?: number; transferSize?: number };
    const resourceSummary = (audits["resource-summary"] as { details?: { items?: ResourceRow[] } } | undefined)?.details?.items || [];
    const getResource = (type: string) => resourceSummary.find((item) => item.resourceType === type);
    const resourceKb = (type: string): number | null => {
      const bytes = getResource(type)?.transferSize;
      return bytes ? Math.round(bytes / 1024) : null;
    };

    const payload: PageSpeedSnapshot = {
      ok: true,
      url,
      strategy,
      fetchedAt: new Date().toISOString(),
      cached: false,
      scores: {
        performance: scoreOf(categories, "performance"),
        accessibility: scoreOf(categories, "accessibility"),
        bestPractices: scoreOf(categories, "best-practices"),
        seo: scoreOf(categories, "seo"),
      },
      metrics: {
        fcpMs: num(audits["first-contentful-paint"]),
        lcpMs: num(audits["largest-contentful-paint"]),
        tbtMs: num(audits["total-blocking-time"]),
        ttiMs: num(audits["interactive"]),
        cls: num(audits["cumulative-layout-shift"]),
        siMs: num(audits["speed-index"]),
        ttfbMs: num(audits["server-response-time"]),
        htmlKb: resourceKb("Document"),
        payloadKb: num(audits["total-byte-weight"]) ? Math.round(num(audits["total-byte-weight"])! / 1024) : null,
        totalRequests: getResource("total")?.requestCount ?? null,
        domNodes: num(audits["dom-size"]),
        imageRequests: getResource("Image")?.requestCount ?? null,
        javascriptKb: resourceKb("Script"),
        cssKb: resourceKb("Stylesheet"),
        fontKb: resourceKb("Font"),
        otherKb: resourceKb("Other"),
      },
      fieldData: {
        available: hasFieldData,
        overall: hasFieldData ? (raw.loadingExperience?.overall_category ?? null) : null,
      },
    };

    payload.diagnostics = readDiagnostics(audits, url);
    cache.set(cacheKey, { at: Date.now(), payload });
    return payload;
  } catch (caught) {
    return unavailable(
      url,
      strategy,
      caught instanceof Error ? caught.message : "PageSpeed Insights is unreachable right now",
    );
  }
}
