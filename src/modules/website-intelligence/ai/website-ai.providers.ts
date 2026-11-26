/**
 * Milestone 5 — OpenAI and Gemini provider clients (official REST APIs).
 *
 * Contract: a provider call either yields raw JSON text plus the usage the provider reported, or a classified
 * failure. Keys are read server-side at call time; they are sent only in headers and never logged or returned.
 * Retries are bounded and only for transient failures (rate limit, timeout, 5xx).
 */

import { aiLimits, modelFor, providerBase, providerKey, type ProviderId } from './website-ai.config';

export type ProviderErrorCode = 'not_configured' | 'auth' | 'billing' | 'rate_limited' | 'timeout' | 'unavailable' | 'bad_response' | 'content_blocked' | 'model_unavailable';

export interface ProviderRequest {
  system: string;
  user: string;
  maxOutputTokens: number;
  /** Overrides the configured model (used for reviewer calls on a cheaper model). */
  model?: string;
  /** Overrides the configured timeout for long answers (several sites compared in one call). */
  timeoutMs?: number;
  /** Internal budget gate, called before each actual outbound attempt. */
  beforeAttempt?: () => Promise<ProviderResult | void>;
}

export interface ProviderUsage {
  inputTokens: number | null;
  outputTokens: number | null;
  cachedInputTokens: number | null;
}

export type ProviderResult =
  | { ok: true; provider: ProviderId; model: string; text: string; usage: ProviderUsage; latencyMs: number; truncated: boolean }
  | { ok: false; provider: ProviderId; model: string; code: ProviderErrorCode; message: string; retryable: boolean; httpStatus: number | null };

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function fail(provider: ProviderId, model: string, code: ProviderErrorCode, message: string, httpStatus: number | null = null): ProviderResult {
  // Auth/permission/model errors are configuration problems: retrying cannot help.
  const retryable = code === 'rate_limited' || code === 'timeout' || code === 'unavailable';
  return { ok: false, provider, model, code, message, retryable, httpStatus };
}

/** Maps an HTTP failure to a stable code. Provider error bodies are inspected only for a short, key-free reason. */
function classify(provider: ProviderId, model: string, status: number, body: any): ProviderResult {
  const reason = String(body?.error?.message ?? body?.error?.status ?? '').slice(0, 160).replace(/(sk-[A-Za-z0-9_-]{6,}|AIza[0-9A-Za-z_-]{10,})/g, '[redacted]');
  if (status === 401) return fail(provider, model, 'auth', `${label(provider)} rejected the API key (HTTP 401). Replace the server key.`, status);
  if (status === 403) return fail(provider, model, 'auth', `${label(provider)} refused the request (HTTP 403): the key lacks access or is restricted.`, status);
  if (status === 402) return fail(provider, model, 'billing', `${label(provider)} reports the account has no usable credits or billing (HTTP 402). Top up or enable billing for this key.`, status);
  if (status === 404) return fail(provider, model, 'model_unavailable', `${label(provider)} does not offer the model "${model}" for this key (HTTP 404).`, status);
  const noCredit = body?.error?.code === 'credit_balance_exhausted' || body?.error?.code === 'insufficient_quota' || /no credits|insufficient[_ ]quota|exceeded your current quota|billing/i.test(reason);
  if (status === 429 && noCredit) return fail(provider, model, 'billing', `${label(provider)} reports the account has no credits left (${reason || 'quota exhausted'}). Add credits at platform.openai.com > Billing.`, status);
  if (status === 429) return fail(provider, model, 'rate_limited', `${label(provider)} rate limit or quota reached (HTTP 429).${reason ? ` ${reason}` : ''}`, status);
  if (status >= 500) return fail(provider, model, 'unavailable', `${label(provider)} is temporarily unavailable (HTTP ${status}).`, status);
  return fail(provider, model, 'bad_response', `${label(provider)} returned HTTP ${status}.${reason ? ` ${reason}` : ''}`, status);
}

const label = (p: ProviderId) => (p === 'openai' ? 'OpenAI' : 'Gemini');

async function once(provider: ProviderId, req: ProviderRequest, key: string, model: string): Promise<ProviderResult> {
  const started = Date.now();
  const controller = new AbortController();
  const timeoutMs = req.timeoutMs ?? aiLimits.timeoutMs();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    let url: string;
    let init: RequestInit;
    if (provider === 'openai') {
      // The gpt-5 / o-series reject `max_tokens` and a custom temperature.
      const reasoning = /^(gpt-5|o\d)/.test(model);
      url = `${providerBase('openai')}/v1/chat/completions`;
      init = {
        method: 'POST',
        headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          response_format: { type: 'json_object' },
          ...(reasoning ? { max_completion_tokens: req.maxOutputTokens } : { max_tokens: req.maxOutputTokens, temperature: 0.2 }),
          messages: [{ role: 'system', content: req.system }, { role: 'user', content: req.user }],
        }),
        signal: controller.signal,
      };
    } else {
      url = `${providerBase('gemini')}/v1beta/models/${encodeURIComponent(model)}:generateContent`;
      init = {
        method: 'POST',
        // The key travels in a header, not the URL, so it cannot end up in access logs.
        headers: { 'x-goog-api-key': key, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: req.system }] },
          contents: [{ role: 'user', parts: [{ text: req.user }] }],
          generationConfig: {
            temperature: 0.2,
            responseMimeType: 'application/json',
            maxOutputTokens: req.maxOutputTokens,
            ...(/flash/.test(model) && !/lite/.test(model) ? { thinkingConfig: { thinkingBudget: 0 } } : {}),
          },
        }),
        signal: controller.signal,
      };
    }
    const response = await fetch(url, init);
    const raw = await response.text();
    let body: any = null;
    try { body = JSON.parse(raw); } catch { body = null; }
    if (!response.ok) return classify(provider, model, response.status, body);
    if (!body) return fail(provider, model, 'bad_response', `${label(provider)} returned a non-JSON response.`, response.status);

    if (provider === 'openai') {
      const choice = body.choices?.[0];
      const text = choice?.message?.content;
      if (choice?.finish_reason === 'content_filter') return fail(provider, model, 'content_blocked', 'OpenAI blocked this request by content policy.', response.status);
      if (typeof text !== 'string' || !text.trim()) return fail(provider, model, 'bad_response', 'OpenAI returned no content.', response.status);
      const u = body.usage ?? {};
      return { ok: true, provider, model: String(body.model ?? model).slice(0, 80), text, latencyMs: Date.now() - started, truncated: choice?.finish_reason === 'length', usage: { inputTokens: num(u.prompt_tokens), outputTokens: num(u.completion_tokens), cachedInputTokens: num(u.prompt_tokens_details?.cached_tokens) } };
    }
    const candidate = body.candidates?.[0];
    if (body.promptFeedback?.blockReason || candidate?.finishReason === 'SAFETY') return fail(provider, model, 'content_blocked', 'Gemini blocked this request by safety policy.', response.status);
    const text = (candidate?.content?.parts ?? []).map((p: any) => (typeof p?.text === 'string' ? p.text : '')).join('');
    if (!text.trim()) return fail(provider, model, 'bad_response', 'Gemini returned no content.', response.status);
    const u = body.usageMetadata ?? {};
    const out = (num(u.candidatesTokenCount) ?? 0) + (num(u.thoughtsTokenCount) ?? 0);
    return { ok: true, provider, model: String(body.modelVersion ?? model).slice(0, 80), text, latencyMs: Date.now() - started, truncated: candidate?.finishReason === 'MAX_TOKENS', usage: { inputTokens: num(u.promptTokenCount), outputTokens: u.candidatesTokenCount === undefined ? null : out, cachedInputTokens: num(u.cachedContentTokenCount) } };
  } catch (error) {
    if ((error as Error)?.name === 'AbortError') return fail(provider, model, 'timeout', `${label(provider)} did not answer within ${Math.round(timeoutMs / 1000)}s.`);
    return fail(provider, model, 'unavailable', `${label(provider)} could not be reached.`);
  } finally {
    clearTimeout(timer);
  }
}

const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);

/* ---------------------------------------------------------------- */
/* Health, pacing and call with bounded retry                        */
/* ---------------------------------------------------------------- */

interface Health { consecutiveFailures: number; openUntil: number; lastOkAt: number | null; lastError: { code: ProviderErrorCode; at: number } | null; lastStart: number }
const health: Record<ProviderId, Health> = {
  openai: { consecutiveFailures: 0, openUntil: 0, lastOkAt: null, lastError: null, lastStart: 0 },
  gemini: { consecutiveFailures: 0, openUntil: 0, lastOkAt: null, lastError: null, lastStart: 0 },
};

export function resetProviderHealth() {
  for (const p of ['openai', 'gemini'] as const) health[p] = { consecutiveFailures: 0, openUntil: 0, lastOkAt: null, lastError: null, lastStart: 0 };
}

export function providerSnapshot(provider: ProviderId) {
  const h = health[provider];
  const configured = Boolean(providerKey(provider));
  const circuitOpen = h.openUntil > Date.now();
  return {
    provider,
    configured,
    model: modelFor(provider),
    state: !configured ? 'not_configured' : circuitOpen ? 'unavailable' : h.lastError && h.consecutiveFailures > 0 ? 'degraded' : 'ready',
    lastOkAt: h.lastOkAt ? new Date(h.lastOkAt).toISOString() : null,
    lastError: h.lastError ? { code: h.lastError.code, at: new Date(h.lastError.at).toISOString() } : null,
    circuitOpenUntil: circuitOpen ? new Date(h.openUntil).toISOString() : null,
  };
}

/**
 * One logical provider call: paced, retried a bounded number of times on transient errors, and tracked for health.
 * An open circuit short-circuits to `unavailable` so a dead provider is not hammered by every page.
 */
export async function callProvider(provider: ProviderId, req: ProviderRequest): Promise<ProviderResult> {
  const model = req.model || modelFor(provider);
  const key = providerKey(provider);
  if (!key) return fail(provider, model, 'not_configured', `${label(provider)} is not configured on the server.`);
  const h = health[provider];
  if (h.openUntil > Date.now()) {
    // Keep the original reason when it was a credentials/model problem, so callers classify it as "unavailable
    // provider" rather than a transient failure.
    const last = h.lastError?.code;
    if (last === 'auth' || last === 'billing' || last === 'model_unavailable') return fail(provider, model, last, `${label(provider)} is paused: its credentials, billing or model were rejected. Fix the server configuration.`);
    return fail(provider, model, 'unavailable', `${label(provider)} is paused after repeated failures; it will be retried shortly.`);
  }

  let result: ProviderResult = fail(provider, model, 'unavailable', 'No attempt was made.');
  const attempts = 1 + aiLimits.retries();
  for (let attempt = 0; attempt < attempts; attempt++) {
    const wait = Math.max(0, h.lastStart + aiLimits.minGapMs() - Date.now());
    h.lastStart = Date.now() + wait;
    if (wait) await sleep(wait);
    const denied = await req.beforeAttempt?.();
    if (denied) return denied;
    result = await once(provider, req, key, model);
    if (result.ok || !result.retryable) break;
    if (attempt < attempts - 1) await sleep(aiLimits.retryBackoffMs() * (attempt + 1));
  }
  if (result.ok) {
    h.consecutiveFailures = 0;
    h.lastOkAt = Date.now();
  } else if (result.code !== 'content_blocked' && result.code !== 'bad_response') {
    h.consecutiveFailures += 1;
    h.lastError = { code: result.code, at: Date.now() };
    // Credentials/model errors open the circuit at once: every further call would fail identically.
    if (result.code === 'auth' || result.code === 'billing' || result.code === 'model_unavailable' || h.consecutiveFailures >= aiLimits.circuitThreshold()) h.openUntil = Date.now() + aiLimits.circuitMs();
  }
  return result;
}
