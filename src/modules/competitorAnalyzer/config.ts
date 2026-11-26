import { z } from "zod";

/*
 * Competitor Analyzer configuration. Read lazily from process.env (not the global env schema) so the rest of the
 * backend never fails to start because of an analyzer setting, and so tests can change values between cases.
 * Every paid or scheduled behaviour is OFF unless explicitly configured.
 */

const bool = (fallback: boolean) =>
  z
    .string()
    .optional()
    .transform((v) => (v === undefined || v === "" ? fallback : /^(1|true|yes|on)$/i.test(v)));
const int = (fallback: number, min: number, max: number) =>
  z
    .string()
    .optional()
    .transform((v) => {
      const n = v === undefined || v === "" ? fallback : Number(v);
      return Number.isFinite(n) ? Math.min(max, Math.max(min, Math.round(n))) : fallback;
    });
const num = (fallback: number, min: number, max: number) =>
  z
    .string()
    .optional()
    .transform((v) => {
      const n = v === undefined || v === "" ? fallback : Number(v);
      return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
    });

const schema = z.object({
  COMPETITOR_ANALYZER_ENABLED: bool(true),
  COMPETITOR_PRIMARY_SITE_URL: z.string().optional(),
  COMPETITOR_MAX_COMPETITORS: int(4, 1, 4),
  COMPETITOR_MAX_PAGES_PER_SITE: int(10, 1, 50),
  COMPETITOR_DEFAULT_PAGES_PER_SITE: int(10, 1, 50),
  COMPETITOR_RUN_COOLDOWN_MINUTES: int(10, 0, 1440),
  COMPETITOR_MAX_ACTIVE_STUDIES: int(50, 1, 500),
  COMPETITOR_SITE_TIMEOUT_MS: int(150_000, 5_000, 600_000),
  COMPETITOR_FETCH_TIMEOUT_MS: int(12_000, 1_000, 60_000),
  COMPETITOR_MAX_BODY_BYTES: int(2_000_000, 50_000, 10_000_000),
  COMPETITOR_DOMAIN_DELAY_MS: int(400, 0, 10_000),
  COMPETITOR_USER_AGENT: z.string().default("MokshaVoyageCompetitorAnalyzer/1.0 (+public website comparison; no form submission)"),
  // AI (OpenAI, backend only). Model must be set explicitly for paid analysis; nothing is assumed.
  COMPETITOR_AI_ENABLED: bool(false),
  COMPETITOR_AI_MODEL: z.string().optional(),
  COMPETITOR_AI_TIMEOUT_MS: int(150_000, 5_000, 600_000),
  COMPETITOR_AI_MAX_OUTPUT_TOKENS: int(24_000, 256, 32_000),
  COMPETITOR_AI_REASONING_EFFORT: z.enum(["low", "medium", "high"]).default("low"),
  COMPETITOR_AI_WEB_SEARCH_ENABLED: bool(false),
  // Pricing used only for cost ESTIMATES (USD per 1M tokens). Unset = cost recorded as not_available.
  COMPETITOR_AI_INPUT_USD_PER_MTOK: num(0, 0, 1_000),
  COMPETITOR_AI_OUTPUT_USD_PER_MTOK: num(0, 0, 1_000),
  COMPETITOR_DAILY_BUDGET_USD: num(0, 0, 10_000),
  COMPETITOR_MAX_RUN_COST_USD: num(0, 0, 1_000),
  // Optional providers
  COMPETITOR_PAGESPEED_ENABLED: bool(false),
  // Workers
  COMPETITOR_INPROCESS_WORKER: bool(true),
  COMPETITOR_WORKER_CONCURRENCY: int(1, 1, 4),
  COMPETITOR_LEASE_MS: int(90_000, 10_000, 600_000),
  COMPETITOR_HEARTBEAT_MS: int(20_000, 1_000, 120_000),
  COMPETITOR_POLL_MS: int(5_000, 500, 60_000),
  COMPETITOR_MAX_ATTEMPTS: int(3, 1, 5),
  COMPETITOR_QUEUE_ENABLED: bool(false),
  COMPETITOR_SCHEDULER_ENABLED: bool(false),
});

export type AnalyzerConfig = z.infer<typeof schema> & { primarySiteUrl: string };

export function analyzerConfig(): AnalyzerConfig {
  const parsed = schema.parse(process.env);
  const primary =
    parsed.COMPETITOR_PRIMARY_SITE_URL || process.env.LIVE_SITE_URL || process.env.SITE_URL || "https://mokshavoyage.in";
  return { ...parsed, primarySiteUrl: primary.replace(/\/+$/, "") };
}

export const ANALYZER_VERSIONS = {
  crawler: "crawl-2026-11-14.2",
  extractor: "extract-2026-11-14.1",
  rubric: "rubric-2026-11-14.2",
  checks: "checks-2026-11-14.2",
} as const;
