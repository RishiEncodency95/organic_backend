/**
 * Milestone 5 — configuration, routing and pricing for Website Intelligence AI.
 *
 * Models are configurable (never assumed): the defaults are conservative, widely available model ids and can be
 * overridden per environment. Keys are read from the environment at call time and never leave the server.
 */

export const PROMPT_VERSION = 'wi-ai-2026-10-14.1';

export const AI_MODES = ['auto', 'openai', 'gemini', 'dual_review', 'disabled'] as const;
export type AiMode = (typeof AI_MODES)[number];
export type ProviderId = 'openai' | 'gemini';

/** Page-level and site-level analysis tasks. Each task is one provider call (plus an optional review call). */
export const AI_TASKS = ['technical_seo', 'content_quality', 'executive_summary'] as const;
export type AiTask = (typeof AI_TASKS)[number];

/** Categories a task may report. Anything outside the task's set is rejected by the validator. */
export const TASK_CATEGORIES: Record<Exclude<AiTask, 'executive_summary'>, readonly string[]> = {
  // OpenAI: technical SEO, root causes, remediation, metadata rewrites, internal linking, measured performance/accessibility.
  technical_seo: ['technical_seo', 'on_page_seo', 'metadata', 'internal_linking', 'performance', 'accessibility', 'regression'],
  // Gemini: content quality, semantic coverage, intent, headings, readability, gaps.
  content_quality: ['content_quality', 'search_intent', 'headings', 'readability', 'content_gap', 'organic_opportunity'],
};

export const SEVERITIES = ['critical', 'high', 'medium', 'low', 'info'] as const;
export type Severity = (typeof SEVERITIES)[number];

/** Default provider per task under `auto`. */
export const TASK_DEFAULT_PROVIDER: Record<AiTask, ProviderId> = {
  technical_seo: 'openai',
  content_quality: 'gemini',
  executive_summary: 'openai',
};

const intEnv = (name: string, fallback: number, min = 0): number => {
  const raw = process.env[name];
  if (raw === undefined || raw.trim() === '') return fallback;
  const n = Number(raw);
  return Number.isFinite(n) && n >= min ? Math.floor(n) : fallback;
};

export const aiLimits = {
  /** Company-wide rolling-24h spend cap in millionths of a US dollar (default $2.00). */
  dailyBudgetMicros: () => intEnv('WEBSITE_AI_DAILY_BUDGET_MICROS', 2_000_000),
  /** Company-wide rolling-24h provider call cap. */
  dailyCalls: () => intEnv('WEBSITE_AI_DAILY_CALLS', 300, 1),
  /** Estimated input tokens one page task may send. */
  pageTokenLimit: () => intEnv('WEBSITE_AI_PAGE_TOKEN_LIMIT', 12_000, 500),
  /** Estimated input+output tokens one analysis run may spend. */
  scanTokenLimit: () => intEnv('WEBSITE_AI_SCAN_TOKEN_LIMIT', 150_000, 1000),
  maxOutputTokens: () => intEnv('WEBSITE_AI_MAX_OUTPUT_TOKENS', 1_800, 200),
  /** The website summary has seven lists, so it needs more room than a page task. */
  summaryMaxOutputTokens: () => intEnv('WEBSITE_AI_SUMMARY_MAX_OUTPUT_TOKENS', 4_000, 400),
  timeoutMs: () => intEnv('WEBSITE_AI_TIMEOUT_MS', 60_000, 1000),
  retries: () => intEnv('WEBSITE_AI_RETRIES', 1, 0),
  retryBackoffMs: () => intEnv('WEBSITE_AI_RETRY_BACKOFF_MS', 1_500, 0),
  /** Minimum gap between two requests to one provider. */
  minGapMs: () => intEnv('WEBSITE_AI_MIN_GAP_MS', 250, 0),
  cacheDays: () => intEnv('WEBSITE_AI_CACHE_DAYS', 14, 0),
  topNDefault: () => intEnv('WEBSITE_AI_TOP_N_DEFAULT', 5, 1),
  topNMax: () => intEnv('WEBSITE_AI_TOP_N_MAX', 15, 1),
  /** Rejected/failed analysis rows are kept this long; completed analyses follow the website's own retention. */
  retentionDays: () => intEnv('WEBSITE_AI_RETENTION_DAYS', 90, 1),
  /** After this many consecutive failures a provider is skipped (circuit open) for `circuitMs`. */
  circuitThreshold: () => intEnv('WEBSITE_AI_CIRCUIT_THRESHOLD', 4, 1),
  circuitMs: () => intEnv('WEBSITE_AI_CIRCUIT_MS', 60_000, 1000),
  defaultMode: (): AiMode => {
    const raw = (process.env.WEBSITE_AI_MODE ?? 'auto').toLowerCase();
    return (AI_MODES as readonly string[]).includes(raw) ? (raw as AiMode) : 'auto';
  },
};

export function modelFor(provider: ProviderId): string {
  if (provider === 'openai') return process.env.WEBSITE_AI_OPENAI_MODEL?.trim() || process.env.OPENAI_MODEL?.trim() || 'gpt-4.1';
  return process.env.WEBSITE_AI_GEMINI_MODEL?.trim() || process.env.GEMINI_MODEL?.trim() || 'gemini-2.5-flash';
}

export function providerKey(provider: ProviderId): string | null {
  const key = provider === 'openai' ? process.env.OPENAI_API_KEY : process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY;
  return key && key.trim() ? key.trim() : null;
}

/** Test-only endpoint override, honoured exclusively when NODE_ENV=test (same convention as the Google clients). */
export function providerBase(provider: ProviderId): string {
  const fallback = provider === 'openai' ? 'https://api.openai.com' : 'https://generativelanguage.googleapis.com';
  if (process.env.NODE_ENV !== 'test') return fallback;
  const override = provider === 'openai' ? process.env.WEBSITE_AI_OPENAI_BASE : process.env.WEBSITE_AI_GEMINI_BASE;
  return override && override.trim() ? override.trim().replace(/\/$/, '') : fallback;
}

/* ---------------------------------------------------------------- */
/* Routing                                                           */
/* ---------------------------------------------------------------- */

export interface RoutePlan {
  primary: ProviderId;
  fallback: ProviderId | null;
  /** Second provider that reviews high-impact findings (dual_review only). */
  reviewer: ProviderId | null;
}

const other = (p: ProviderId): ProviderId => (p === 'openai' ? 'gemini' : 'openai');

/**
 * Chooses providers for one task. Only providers that are configured are used; a missing provider never produces
 * a call. `dual_review` keeps the task's natural primary and adds the other provider as a reviewer.
 */
export function routeTask(task: AiTask, mode: AiMode, configured: { openai: boolean; gemini: boolean }): RoutePlan | null {
  if (mode === 'disabled') return null;
  const natural = mode === 'openai' ? 'openai' : mode === 'gemini' ? 'gemini' : TASK_DEFAULT_PROVIDER[task];
  const available = (p: ProviderId) => configured[p];
  let primary: ProviderId | null = available(natural) ? natural : null;
  // `auto`/`dual_review` may fall back across providers; an explicit single-provider mode may too, because an
  // unavailable chosen provider is better served by the other than by silence (the result names the real provider).
  if (!primary && available(other(natural))) primary = other(natural);
  if (!primary) return null;
  const fallback = available(other(primary)) ? other(primary) : null;
  return { primary, fallback, reviewer: mode === 'dual_review' && fallback ? fallback : null };
}

/* ---------------------------------------------------------------- */
/* Pricing (estimates, USD micros per 1,000 tokens)                  */
/* ---------------------------------------------------------------- */

export const PRICING_VERSION = 'website-ai-2026-10-estimated';
const PRICES: Record<string, { input: number; output: number; cached?: number }> = {
  'gpt-4.1': { input: 2_000, output: 8_000, cached: 500 },
  'gpt-4.1-mini': { input: 400, output: 1_600, cached: 100 },
  'gpt-4.1-nano': { input: 100, output: 400, cached: 25 },
  'gpt-4o': { input: 2_500, output: 10_000, cached: 1_250 },
  'gpt-4o-mini': { input: 150, output: 600, cached: 75 },
  'gpt-5': { input: 1_250, output: 10_000, cached: 125 },
  'gpt-5-mini': { input: 250, output: 2_000, cached: 25 },
  'gemini-2.5-flash': { input: 300, output: 2_500 },
  'gemini-2.5-flash-lite': { input: 100, output: 400 },
  'gemini-2.5-pro': { input: 1_250, output: 10_000 },
};

/** Conservative price used when a model is not in the table, so budget checks never under-count. */
const UNKNOWN_PRICE = { input: 2_500, output: 10_000 };

export function priceFor(model: string): { input: number; output: number; cached?: number; known: boolean } {
  const exact = PRICES[model];
  if (exact) return { ...exact, known: true };
  // Dated/aliased ids (gpt-4.1-2025-04-14, gemini-2.5-flash-latest) price like their family.
  const family = Object.keys(PRICES).sort((a, b) => b.length - a.length).find((id) => model.startsWith(id));
  if (family) return { ...PRICES[family]!, known: true };
  return { ...UNKNOWN_PRICE, known: false };
}

export function costMicros(model: string, input: number, output: number, cachedInput = 0): { micros: number; known: boolean } {
  const p = priceFor(model);
  const billable = Math.max(0, input - cachedInput);
  const micros = (billable * p.input + cachedInput * (p.cached ?? p.input) + output * p.output) / 1000;
  return { micros: Math.ceil(micros), known: p.known };
}

/** Rough token estimate (≈4 characters per token) used only for pre-call budget checks. */
export const estimateTokens = (text: string): number => Math.ceil(text.length / 4);
