import crypto from "node:crypto";

/*
 * Google OAuth 2.0 (web client) for the OWN Search Console property only. Read-only scope.
 *  - state = base64url(payload).hmac — signed, 10-minute expiry, single-use nonce (checked against the DB)
 *  - refresh token is stored AES-256-GCM encrypted; access tokens are never stored
 *  - Google endpoints are fixed, trusted hosts (not user-supplied), so plain fetch is used here
 * Config: GOOGLE_OAUTH_CLIENT_ID, GOOGLE_OAUTH_CLIENT_SECRET, GOOGLE_OAUTH_REDIRECT_URI,
 *         COMPETITOR_TOKEN_ENCRYPTION_KEY (optional; falls back to COOKIE_SECRET).
 */

export const GSC_SCOPE = "https://www.googleapis.com/auth/webmasters.readonly";
const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const REVOKE_URL = "https://oauth2.googleapis.com/revoke";
const STATE_TTL_MS = 10 * 60_000;

export interface OAuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

export function oauthConfig(): OAuthConfig | null {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_OAUTH_REDIRECT_URI;
  return clientId && clientSecret && redirectUri ? { clientId, clientSecret, redirectUri } : null;
}

const secret = () => process.env.COMPETITOR_TOKEN_ENCRYPTION_KEY || process.env.COOKIE_SECRET || "";
const key = () => crypto.createHash("sha256").update(`competitor-oauth:${secret()}`).digest();
const b64u = (b: Buffer) => b.toString("base64url");

export function encryptToken(plain: string): string {
  if (!secret()) throw new Error("No encryption secret configured");
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv("aes-256-gcm", key(), iv);
  const enc = Buffer.concat([c.update(plain, "utf8"), c.final()]);
  return `v1.${b64u(iv)}.${b64u(c.getAuthTag())}.${b64u(enc)}`;
}

export function decryptToken(blob: string): string {
  const [v, iv, tag, data] = blob.split(".");
  if (v !== "v1" || !iv || !tag || !data) throw new Error("Unknown token format");
  const d = crypto.createDecipheriv("aes-256-gcm", key(), Buffer.from(iv, "base64url"));
  d.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([d.update(Buffer.from(data, "base64url")), d.final()]).toString("utf8");
}

const hmac = (s: string) => crypto.createHmac("sha256", key()).update(s).digest("base64url");

export function signState(userId: string, nonce: string, now = Date.now()): string {
  const payload = b64u(Buffer.from(JSON.stringify({ uid: userId, n: nonce, exp: now + STATE_TTL_MS })));
  return `${payload}.${hmac(payload)}`;
}

export function verifyState(state: string, now = Date.now()): { uid: string; nonce: string } | null {
  const [payload, sig] = String(state || "").split(".");
  if (!payload || !sig) return null;
  const expected = hmac(payload);
  if (expected.length !== sig.length || !crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(sig))) return null;
  try {
    const p = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (typeof p.exp !== "number" || p.exp < now || typeof p.uid !== "string" || typeof p.n !== "string") return null;
    return { uid: p.uid, nonce: p.n };
  } catch {
    return null;
  }
}

export function buildAuthUrl(cfg: OAuthConfig, state: string): string {
  const q = new URLSearchParams({
    client_id: cfg.clientId,
    redirect_uri: cfg.redirectUri,
    response_type: "code",
    scope: `openid email ${GSC_SCOPE}`,
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
    state,
  });
  return `${AUTH_URL}?${q}`;
}

export interface TokenResponse {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
  scope?: string;
  id_token?: string;
}

type FetchLike = typeof fetch;

export async function exchangeCode(cfg: OAuthConfig, code: string, fetchImpl: FetchLike = fetch): Promise<TokenResponse> {
  const res = await fetchImpl(TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ code, client_id: cfg.clientId, client_secret: cfg.clientSecret, redirect_uri: cfg.redirectUri, grant_type: "authorization_code" }),
    signal: AbortSignal.timeout(20_000),
  });
  const j: any = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`Google token exchange failed: ${j.error ?? res.status}${j.error_description ? ` (${j.error_description})` : ""}`);
  return j as TokenResponse;
}

export async function refreshAccessToken(cfg: OAuthConfig, refreshToken: string, fetchImpl: FetchLike = fetch): Promise<string> {
  const res = await fetchImpl(TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ refresh_token: refreshToken, client_id: cfg.clientId, client_secret: cfg.clientSecret, grant_type: "refresh_token" }),
    signal: AbortSignal.timeout(20_000),
  });
  const j: any = await res.json().catch(() => ({}));
  if (!res.ok || !j.access_token) {
    const err = new Error(`Google token refresh failed: ${j.error ?? res.status}`);
    (err as any).revoked = j.error === "invalid_grant";
    throw err;
  }
  return j.access_token as string;
}

export async function revokeToken(token: string, fetchImpl: FetchLike = fetch) {
  await fetchImpl(`${REVOKE_URL}?${new URLSearchParams({ token })}`, { method: "POST", signal: AbortSignal.timeout(15_000) }).catch(() => undefined);
}

/** Email from the id_token payload (token came straight from Google's token endpoint over TLS). */
export function emailFromIdToken(idToken?: string): string | null {
  if (!idToken) return null;
  try {
    const p = JSON.parse(Buffer.from(idToken.split(".")[1], "base64url").toString("utf8"));
    return typeof p.email === "string" ? p.email : null;
  } catch {
    return null;
  }
}
