/**
 * Google API plumbing shared by the performance and search pipelines: endpoint
 * resolution, service-account tokens and the mapping of Google's error payloads
 * to the states the UI can explain.
 *
 * Test seams (`PAGESPEED_API_BASE`, `CRUX_API_BASE`, `SEARCH_CONSOLE_API_BASE`,
 * `WEBSITE_TEST_GOOGLE_TOKEN`) are honoured ONLY when NODE_ENV === 'test', so a
 * production misconfiguration can never redirect credentials to another host.
 */

import { createSign } from 'node:crypto';

const testMode = () => process.env.NODE_ENV === 'test';

export const GOOGLE_DEFAULTS = {
  pagespeed: 'https://www.googleapis.com/pagespeedonline/v5/runPagespeed',
  crux: 'https://chromeuxreport.googleapis.com/v1',
  searchConsole: 'https://searchconsole.googleapis.com',
} as const;

export function googleEndpoint(kind: keyof typeof GOOGLE_DEFAULTS): string {
  if (testMode()) {
    const override = { pagespeed: process.env.PAGESPEED_API_BASE, crux: process.env.CRUX_API_BASE, searchConsole: process.env.SEARCH_CONSOLE_API_BASE }[kind];
    if (override) return override.replace(/\/$/, '');
  }
  return GOOGLE_DEFAULTS[kind];
}

/** Google API key for PageSpeed / CrUX. CrUX may use its own key; otherwise the PageSpeed key is reused. */
export function googleApiKey(kind: 'pagespeed' | 'crux'): string | null {
  const key = kind === 'crux' ? process.env.CRUX_API_KEY || process.env.PAGESPEED_API_KEY : process.env.PAGESPEED_API_KEY;
  return key && key.trim() ? key.trim() : null;
}

/** OAuth access token for the configured service account, or null when none is configured / the exchange fails. */
export async function googleAccessToken(scope: string): Promise<string | null> {
  if (testMode() && process.env.WEBSITE_TEST_GOOGLE_TOKEN) return process.env.WEBSITE_TEST_GOOGLE_TOKEN;
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const key = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.replace(/\\n/g, '\n');
  if (!email || !key) return null;
  const now = Math.floor(Date.now() / 1000);
  const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url');
  const unsigned = `${encode({ alg: 'RS256', typ: 'JWT' })}.${encode({ iss: email, scope, aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600 })}`;
  const signer = createSign('RSA-SHA256');
  signer.update(unsigned);
  const assertion = `${unsigned}.${signer.sign(key, 'base64url')}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15_000);
  try {
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion }),
      signal: controller.signal,
    });
    if (!response.ok) return null;
    return ((await response.json()) as { access_token?: string }).access_token ?? null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export type GoogleFailureCode =
  | 'not_configured'
  | 'quota_exceeded'
  | 'api_key_blocked'
  | 'service_disabled'
  | 'not_authorized'
  | 'invalid_url'
  | 'target_unreachable'
  | 'not_found'
  | 'timeout'
  | 'failed';

export interface GoogleFailure {
  ok: false;
  code: GoogleFailureCode;
  message: string;
  httpStatus: number | null;
  retryable: boolean;
}

/** Maps a non-2xx Google response to a stable code plus an actionable message. */
export function classifyGoogleError(api: 'PageSpeed Insights' | 'Chrome UX Report' | 'Search Console' | 'Knowledge Graph Search', status: number, body: any): GoogleFailure {
  const err = body?.error ?? {};
  const reasons: string[] = [...(err.details ?? [])].map((d: any) => d?.reason).filter(Boolean);
  const detailMessage = String(err.message ?? '').slice(0, 200);
  const fail = (code: GoogleFailureCode, message: string, retryable = false): GoogleFailure => ({ ok: false, code, message, httpStatus: status, retryable });
  if (status === 429 || err.status === 'RESOURCE_EXHAUSTED' || reasons.includes('RATE_LIMIT_EXCEEDED') || reasons.includes('RATE_LIMIT_EXCEEDED_USER')) {
    return fail('quota_exceeded', `${api} quota is exhausted. Try again later.`, true);
  }
  if (reasons.includes('API_KEY_SERVICE_BLOCKED')) {
    return fail('api_key_blocked', `${api} returned HTTP 403: this API key has API restrictions that do not include "${api} API". In Google Cloud Console → Credentials, edit the key and add that API.`);
  }
  if (reasons.includes('SERVICE_DISABLED')) {
    return fail('service_disabled', `${api} returned HTTP 403: the "${api} API" is not enabled in the Google Cloud project that owns this key. Enable it under APIs & Services → Library.`);
  }
  if (reasons.includes('API_KEY_INVALID') || reasons.includes('API_KEY_HTTP_REFERRER_BLOCKED') || reasons.includes('API_KEY_IP_ADDRESS_BLOCKED')) {
    return fail('api_key_blocked', `${api} rejected the API key (${reasons.find((r) => r.startsWith('API_KEY'))}).`);
  }
  if (status === 401 || status === 403) return fail('not_authorized', `${api} refused the request (HTTP ${status})${detailMessage ? `: ${detailMessage}` : '.'}`);
  if (status === 404) return fail('not_found', `${api} has no data for this target.`);
  if (status === 400 && /FAILED_DOCUMENT_REQUEST|ERR_|could not|unreachable/i.test(`${detailMessage} ${reasons.join(' ')} ${err.status ?? ''}`)) {
    return fail('target_unreachable', `${api} could not load the page${detailMessage ? `: ${detailMessage}` : '.'}`);
  }
  if (status === 400) return fail('invalid_url', `${api} rejected the request${detailMessage ? `: ${detailMessage}` : '.'}`);
  if (status >= 500) return fail('failed', `${api} is temporarily unavailable (HTTP ${status}).`, true);
  return fail('failed', `${api} returned HTTP ${status}${detailMessage ? `: ${detailMessage}` : '.'}`);
}

/** fetch with a hard timeout; a network/timeout error becomes a GoogleFailure instead of throwing. */
export type GoogleHttp = { ok: true; status: number; httpOk: boolean; body: any } | GoogleFailure;

export async function googleFetch(url: string, init: RequestInit, timeoutMs: number, fetcher: typeof fetch = fetch): Promise<GoogleHttp> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetcher(url, { ...init, signal: controller.signal });
    const body = await response.json().catch(() => null);
    return { ok: true, status: response.status, httpOk: response.ok, body };
  } catch (error) {
    const aborted = error instanceof Error && error.name === 'AbortError';
    return { ok: false, code: aborted ? 'timeout' : 'failed', message: aborted ? `Request timed out after ${Math.round(timeoutMs / 1000)}s.` : `Network error: ${error instanceof Error ? error.message.slice(0, 120) : 'unknown'}`, httpStatus: null, retryable: true };
  } finally {
    clearTimeout(timer);
  }
}
