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

function unavailable(url: string, strategy: "mobile" | "desktop", message: string): PageSpeedSnapshot {
  return {
    ok: false,
    message,
    url,
    strategy,
    fetchedAt: new Date().toISOString(),
    cached: false,
    scores: { performance: null, accessibility: null, bestPractices: null, seo: null },
    metrics: {
      fcpMs: null, lcpMs: null, tbtMs: null, cls: null, siMs: null, ttfbMs: null,
      htmlKb: null, payloadKb: null, totalRequests: null, domNodes: null,
      imageRequests: null, javascriptKb: null, cssKb: null, fontKb: null, otherKb: null,
    },
    fieldData: { available: false, overall: null },
  };
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

  const params = new URLSearchParams({ url, strategy, source: "bharat-organic-admin" });
  ["performance", "accessibility", "best-practices", "seo"].forEach((category) =>
    params.append("category", category),
  );
  const key = process.env.PAGESPEED_API_KEY || process.env.PSI_API_KEY;
  if (key) params.set("key", key);

  try {
    const response = await fetch(`${PSI_ENDPOINT}?${params.toString()}`, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(120_000),
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      return unavailable(
        url,
        strategy,
        `PageSpeed Insights responded with ${response.status}${detail ? `: ${detail.slice(0, 200)}` : ""}`,
      );
    }

    const raw = (await response.json()) as {
      lighthouseResult?: {
        categories?: Record<string, { score?: number | null }>;
        audits?: Record<string, unknown>;
      };
      loadingExperience?: { overall_category?: string; initial_record?: { metrics?: Record<string, unknown> } };
    };

    const categories = raw.lighthouseResult?.categories;
    const audits = raw.lighthouseResult?.audits || {};
    if (!categories) {
      return unavailable(url, strategy, "PageSpeed Insights returned no lighthouseResult for this URL");
    }

    const fieldMetrics = raw.loadingExperience?.initial_record?.metrics;
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
