import OpenAI from "openai";
import { analyzerConfig } from "../config";

/*
 * Backend-only OpenAI adapter (Responses API, structured JSON-schema output, optional web_search tool).
 * - Never retries by itself (maxRetries: 0). The caller decides, using `errorClass`:
 *     not_sent   → safe to retry (request never left / was rejected before processing, e.g. 429, 401, 400)
 *     uncertain  → the request may have been processed and billed (timeout / connection drop after send):
 *                  DO NOT retry automatically; the usage row is marked for reconciliation
 * - Provider readiness is explicit: disabled / not_configured / ready. No silent mock output.
 */

export type AiReadiness = { state: "ready" | "disabled" | "not_configured"; reason: string | null; model: string | null; webSearch: boolean };

export interface AiCallInput {
  task: string;
  promptVersion: string;
  system: string;
  user: string;
  schemaName: string;
  schema: Record<string, unknown>;
  maxOutputTokens?: number;
  webSearch?: boolean;
}

export interface AiUsage {
  inputTokens: number | null;
  outputTokens: number | null;
  totalTokens: number | null;
}

export type AiErrorClass = "not_sent" | "uncertain" | "invalid_output";

export interface AiCallResult {
  ok: boolean;
  data: unknown;
  rawText: string | null;
  usage: AiUsage;
  /** URLs the provider's web_search cited (url_citation annotations / sources). Empty without web search. */
  citations: string[];
  model: string | null;
  responseId: string | null;
  error: string | null;
  errorClass: AiErrorClass | null;
  httpStatus: number | null;
}

export interface AiProvider {
  readiness(): AiReadiness;
  call(input: AiCallInput): Promise<AiCallResult>;
}

/** Last provider failure (shown in Provider Health so the admin sees WHY AI stopped, e.g. no credits). */
export let lastAiError: { at: string; message: string; status: number | null } | null = null;
export const clearLastAiError = () => {
  lastAiError = null;
};

export function openAiReadiness(): AiReadiness {
  // Hard stop: automated tests can never reach the paid API, whatever the environment says.
  if (process.env.JEST_WORKER_ID) return { state: "disabled", reason: "Live AI is never called from automated tests.", model: null, webSearch: false };
  const cfg = analyzerConfig();
  if (!cfg.COMPETITOR_AI_ENABLED) return { state: "disabled", reason: "COMPETITOR_AI_ENABLED is off.", model: null, webSearch: false };
  if (!process.env.OPENAI_API_KEY) return { state: "not_configured", reason: "OPENAI_API_KEY is not set on the backend.", model: null, webSearch: false };
  if (!cfg.COMPETITOR_AI_MODEL) return { state: "not_configured", reason: "COMPETITOR_AI_MODEL is not set (choose a model you have verified and budgeted).", model: null, webSearch: false };
  if (!(cfg.COMPETITOR_DAILY_BUDGET_USD > 0) || !(cfg.COMPETITOR_AI_INPUT_USD_PER_MTOK > 0) || !(cfg.COMPETITOR_AI_OUTPUT_USD_PER_MTOK > 0)) {
    return { state: "not_configured", reason: "AI budget is not configured (COMPETITOR_DAILY_BUDGET_USD and per-token prices are required).", model: cfg.COMPETITOR_AI_MODEL, webSearch: false };
  }
  return { state: "ready", reason: null, model: cfg.COMPETITOR_AI_MODEL, webSearch: cfg.COMPETITOR_AI_WEB_SEARCH_ENABLED };
}

const emptyUsage: AiUsage = { inputTokens: null, outputTokens: null, totalTokens: null };

function collectCitations(response: any): string[] {
  const urls = new Set<string>();
  for (const item of response?.output ?? []) {
    if (item?.type === "message") {
      for (const c of item.content ?? []) for (const a of c?.annotations ?? []) if (a?.type === "url_citation" && typeof a.url === "string") urls.add(a.url);
    }
    if (item?.type === "web_search_call") for (const s of item?.action?.sources ?? []) if (typeof s?.url === "string") urls.add(s.url);
  }
  return [...urls].slice(0, 200);
}

export class OpenAiProvider implements AiProvider {
  constructor(private readonly clientFactory: () => OpenAI = () => new OpenAI({ apiKey: process.env.OPENAI_API_KEY, timeout: analyzerConfig().COMPETITOR_AI_TIMEOUT_MS, maxRetries: 0 })) {}

  readiness(): AiReadiness {
    return openAiReadiness();
  }

  async call(input: AiCallInput): Promise<AiCallResult> {
    const ready = this.readiness();
    const base = { usage: emptyUsage, citations: [], model: ready.model, responseId: null, rawText: null, data: null, httpStatus: null };
    if (ready.state !== "ready") return { ...base, ok: false, error: ready.reason, errorClass: "not_sent" };
    if (input.webSearch && !ready.webSearch) return { ...base, ok: false, error: "Web search is not enabled (COMPETITOR_AI_WEB_SEARCH_ENABLED).", errorClass: "not_sent" };
    const cfg = analyzerConfig();
    try {
      const client = this.clientFactory();
      const response: any = await client.responses.create({
        model: ready.model as string,
        instructions: input.system,
        input: input.user,
        max_output_tokens: input.maxOutputTokens ?? cfg.COMPETITOR_AI_MAX_OUTPUT_TOKENS,
        ...(/^(gpt-[56](?:[.-]|$)|o[134](?:-|$))/.test(ready.model ?? "") ? { reasoning: { effort: cfg.COMPETITOR_AI_REASONING_EFFORT } } : {}),
        text: { format: { type: "json_schema", name: input.schemaName, schema: input.schema, strict: true } },
        ...(input.webSearch ? { tools: [{ type: "web_search" }], include: ["web_search_call.action.sources"] } : {}),
        store: false,
      } as any);
      const usage: AiUsage = {
        inputTokens: response?.usage?.input_tokens ?? null,
        outputTokens: response?.usage?.output_tokens ?? null,
        totalTokens: response?.usage?.total_tokens ?? null,
      };
      const rawText: string = response?.output_text ?? "";
      const citations = collectCitations(response);
      if (response?.status && response.status !== "completed") {
        const error = `Response status ${response.status}${response?.incomplete_details?.reason ? ` (${response.incomplete_details.reason})` : ""}${response?.incomplete_details?.reason === "max_output_tokens" ? ". AI output reached its token limit; the saved evidence comparison is still available. A new analysis uses the configured output limit." : ""}`;
        lastAiError = { at: new Date().toISOString(), message: error, status: 200 };
        return { ...base, ok: false, usage, citations, rawText: rawText.slice(0, 2_000), responseId: response.id ?? null, error, errorClass: "invalid_output" };
      }
      let data: unknown;
      try {
        data = JSON.parse(rawText);
      } catch {
        return { ...base, ok: false, usage, citations, rawText: rawText.slice(0, 2_000), responseId: response.id ?? null, error: "Model output was not valid JSON.", errorClass: "invalid_output" };
      }
      lastAiError = null;
      return { ok: true, data, rawText: rawText.slice(0, 50_000), usage, citations, model: response.model ?? ready.model, responseId: response.id ?? null, error: null, errorClass: null, httpStatus: 200 };
    } catch (e: any) {
      const status: number | null = typeof e?.status === "number" ? e.status : null;
      // An HTTP status means OpenAI answered with an error → request was not processed as a billable completion.
      // No status (timeout / socket hang-up / abort after send) → outcome unknown.
      const errorClass: AiErrorClass = status !== null ? "not_sent" : "uncertain";
      const code = String(e?.code ?? e?.error?.code ?? "");
      const type = String(e?.type ?? e?.error?.type ?? "");
      const msg =
        status === 429 && (type === "insufficient_quota" || /credit|quota/i.test(code))
          ? "OpenAI account has no credits left (insufficient_quota). Add credits at platform.openai.com → Settings → Billing; the chatbot uses the same key."
          : status === 429
            ? "OpenAI rate limit reached (HTTP 429). Wait a minute and try again."
            : status === 401
              ? "OpenAI rejected the API key (HTTP 401). Check OPENAI_API_KEY."
              : status === 404
                ? `OpenAI model not available to this key (HTTP 404). Check COMPETITOR_AI_MODEL.`
                : `${e?.name ?? "Error"}: ${String(e?.message ?? e).slice(0, 300)}`;
      lastAiError = { at: new Date().toISOString(), message: msg, status };
      return { ...base, ok: false, error: msg, errorClass, httpStatus: status };
    }
  }
}

/** Cost estimate in USD from token counts; null when pricing is not configured or tokens are unknown. */
export function estimateCostUsd(usage: AiUsage): number | null {
  const cfg = analyzerConfig();
  if (!(cfg.COMPETITOR_AI_INPUT_USD_PER_MTOK > 0) || !(cfg.COMPETITOR_AI_OUTPUT_USD_PER_MTOK > 0) || usage.inputTokens === null || usage.outputTokens === null) return null;
  return Math.round(((usage.inputTokens * cfg.COMPETITOR_AI_INPUT_USD_PER_MTOK + usage.outputTokens * cfg.COMPETITOR_AI_OUTPUT_USD_PER_MTOK) / 1_000_000) * 1e6) / 1e6;
}

/**
 * Input tokens the web_search tool adds on top of the prompt (search results are fed back to the model).
 * Measured live 2026-11-14: ~8.6k tokens for a one-line prompt and ~38k for a 15-candidate discovery; reserved generously.
 */
export const WEB_SEARCH_INPUT_TOKEN_ALLOWANCE = 50_000;

/** Upper-bound reservation before a call: chars/3 input tokens (+ web-search allowance) + max output tokens. */
export function reserveCostUsd(inputChars: number, maxOutputTokens: number, webSearch = false): number | null {
  return estimateCostUsd({ inputTokens: Math.ceil(inputChars / 3) + (webSearch ? WEB_SEARCH_INPUT_TOKEN_ALLOWANCE : 0), outputTokens: maxOutputTokens, totalTokens: null });
}
