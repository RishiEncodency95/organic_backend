/**
 * Real Google Search Console integration.
 *
 * Two auth methods are supported (in priority order):
 *
 *   1. OAuth refresh-token flow (preferred, no service-account key needed):
 *        GSC_OAUTH_CLIENT_ID      OAuth client ID
 *        GSC_OAUTH_CLIENT_SECRET  OAuth client secret
 *        GSC_OAUTH_REFRESH_TOKEN  long-lived refresh token
 *      The refresh token is exchanged for a short-lived access token that is
 *      cached in memory until shortly before it expires.
 *
 *   2. Service-account flow (fallback):
 *        GSC_SERVICE_ACCOUNT_JSON  JSON string, base64 JSON, or a file path
 *        or GOOGLE_SERVICE_ACCOUNT_EMAIL + GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY
 *
 *   GSC_SITE_URL              property to query, e.g. "https://bharatorganicexpo.com"
 *
 * When the credentials are absent the service honestly reports
 * `available: false` — it never substitutes placeholder metrics.
 */

import * as crypto from "crypto";
import * as fs from "fs";

const GSC_SCOPE = "https://www.googleapis.com/auth/webmasters.readonly";

export interface GscPageRow {
  page: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

export interface GscResult {
  available: boolean;
  message: string | null;
  siteUrl: string | null;
  rangeStart: string | null;
  rangeEnd: string | null;
  totals: { clicks: number; impressions: number; ctr: number; position: number } | null;
  pages: GscPageRow[];
  fetchedAt: string | null;
}

interface ServiceAccount {
  client_email: string;
  private_key: string;
  token_uri?: string;
}

function notAvailable(message: string, siteUrl: string | null = null): GscResult {
  return {
    available: false,
    message,
    siteUrl,
    rangeStart: null,
    rangeEnd: null,
    totals: null,
    pages: [],
    fetchedAt: null,
  };
}

function loadServiceAccount(): ServiceAccount | null {
  const raw = process.env.GSC_SERVICE_ACCOUNT_JSON;
  if (raw) {
    try {
      // Accept a file path, a raw JSON string, or base64-encoded JSON.
      let text = raw;
      if (raw.trim().startsWith("/") || raw.trim().startsWith("./")) {
        text = fs.readFileSync(raw.trim(), "utf8");
      } else if (!raw.trim().startsWith("{")) {
        text = Buffer.from(raw, "base64").toString("utf8");
      }
      const parsed = JSON.parse(text) as ServiceAccount;
      if (parsed.client_email && parsed.private_key) return parsed;
    } catch {
      // fall through to split-env format
    }
  }

  // Split format: GOOGLE_SERVICE_ACCOUNT_EMAIL + GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const privateKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY;
  if (email && privateKey) {
    return { client_email: email, private_key: privateKey };
  }
  return null;
}

function base64url(input: Buffer | string): string {
  return Buffer.from(input).toString("base64").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

function signJwt(sa: ServiceAccount, scope: string): string {
  const header = { alg: "RS256", typ: "JWT" };
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iss: sa.client_email,
    scope,
    aud: sa.token_uri || "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  };
  const data = `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(payload))}`;
  const sign = crypto.createSign("RSA-SHA256");
  sign.update(data);
  const signature = sign.sign(sa.private_key);
  return `${data}.${base64url(signature)}`;
}

async function accessToken(sa: ServiceAccount): Promise<string> {
  const assertion = signJwt(sa, "https://www.googleapis.com/auth/webmasters.readonly");
  const res = await fetch(sa.token_uri || "https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Token exchange failed (${res.status}): ${text.slice(0, 200)}`);
  }
  const data = (await res.json()) as { access_token?: string };
  if (!data.access_token) throw new Error("Token exchange returned no access_token");
  return data.access_token;
}

function getOAuthCreds(): { clientId: string; clientSecret: string; refreshToken: string } | null {
  const clientId = process.env.GSC_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GSC_OAUTH_CLIENT_SECRET;
  const refreshToken = process.env.GSC_OAUTH_REFRESH_TOKEN;
  if (clientId && clientSecret && refreshToken) {
    return { clientId, clientSecret, refreshToken };
  }
  return null;
}

// In-memory cache for the OAuth access token (expires_in is 3600s).
let oauthTokenCache: { token: string; expiresAt: number } | null = null;

async function getOAuthAccessToken(): Promise<string> {
  const creds = getOAuthCreds();
  if (!creds) throw new Error("OAuth credentials are not configured");

  // Reuse cached token if it still has > 60s of life left.
  if (oauthTokenCache && Date.now() < oauthTokenCache.expiresAt - 60_000) {
    return oauthTokenCache.token;
  }

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: creds.clientId,
      client_secret: creds.clientSecret,
      refresh_token: creds.refreshToken,
      grant_type: "refresh_token",
    }),
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`OAuth token refresh failed (${res.status}): ${text.slice(0, 200)}`);
  }
  const data = (await res.json()) as { access_token?: string; expires_in?: number };
  if (!data.access_token) throw new Error("OAuth token refresh returned no access_token");

  const ttl = (data.expires_in ?? 3600) * 1000;
  oauthTokenCache = { token: data.access_token, expiresAt: Date.now() + ttl };
  return data.access_token;
}

/** Resolve an access token: OAuth refresh-token flow first, service account fallback. */
export async function resolveGscAccessToken(): Promise<string> {
  if (getOAuthCreds()) return getOAuthAccessToken();
  const sa = loadServiceAccount();
  if (sa) return accessToken(sa);
  throw new Error(
    "Search Console is not connected. Set GSC_OAUTH_CLIENT_ID + GSC_OAUTH_CLIENT_SECRET + GSC_OAUTH_REFRESH_TOKEN (or service-account credentials).",
  );
}

/**
 * Fetches real Search Console clicks/impressions/position for the last
 * `days` days, broken down by `dimension` ("page" by default, or "query"
 * for top search queries). Returns `available: false` when credentials are absent.
 */
export async function fetchSearchAnalytics(days = 28, dimension: "page" | "query" = "page"): Promise<GscResult> {
  const configured = Boolean(getOAuthCreds()) || Boolean(loadServiceAccount());
  if (!configured) {
    return notAvailable(
      "Search Console is not connected. Set GSC_OAUTH_CLIENT_ID + GSC_OAUTH_CLIENT_SECRET + GSC_OAUTH_REFRESH_TOKEN and add the app as an Owner in Search Console.",
    );
  }
  const siteUrl =
    process.env.GSC_SITE_URL ||
    process.env.SEARCH_CONSOLE_SITE_URL ||
    "https://bharatorganicexpo.com";
  try {
    const token = await resolveGscAccessToken();
    const end = new Date();
    const start = new Date(Date.now() - days * 86_400_000);
    const rangeStart = start.toISOString().split("T")[0];
    const rangeEnd = end.toISOString().split("T")[0];

    const res = await fetch(
      `https://searchconsole.googleapis.com/webmasters/v3/sites/${encodeURIComponent(siteUrl)}/searchAnalytics/query`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          startDate: rangeStart,
          endDate: rangeEnd,
          dimensions: [dimension],
          rowLimit: 250,
          startRow: 0,
        }),
        signal: AbortSignal.timeout(30_000),
      },
    );

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return notAvailable(`Search Console query failed (${res.status}): ${text.slice(0, 200)}`, siteUrl);
    }

    const data = (await res.json()) as {
      rows?: Array<{
        keys?: string[];
        clicks?: number;
        impressions?: number;
        ctr?: number;
        position?: number;
      }>;
    };

    const pages: GscPageRow[] = (data.rows || []).map((row) => ({
      page: row.keys?.[0] ?? "",
      clicks: row.clicks ?? 0,
      impressions: row.impressions ?? 0,
      ctr: Number(((row.ctr ?? 0) * 100).toFixed(2)),
      position: Number((row.position ?? 0).toFixed(1)),
    }));

    const totals = pages.reduce(
      (acc, row) => ({
        clicks: acc.clicks + row.clicks,
        impressions: acc.impressions + row.impressions,
        ctr: 0,
        position: 0,
      }),
      { clicks: 0, impressions: 0, ctr: 0, position: 0 },
    );
    totals.ctr = totals.impressions ? Number(((totals.clicks / totals.impressions) * 100).toFixed(2)) : 0;
    totals.position = totals.impressions
      ? Number((pages.reduce((a, p) => a + p.position * p.impressions, 0) / totals.impressions).toFixed(1))
      : 0;

    return {
      available: true,
      message: null,
      siteUrl,
      rangeStart,
      rangeEnd,
      totals,
      pages,
      fetchedAt: new Date().toISOString(),
    };
  } catch (err) {
    return notAvailable(err instanceof Error ? err.message : String(err), siteUrl);
  }
}

/** True when OAuth or service-account credentials are present in the environment. */
export function isSearchConsoleConfigured(): boolean {
  return Boolean(
    getOAuthCreds() ||
      process.env.GSC_SERVICE_ACCOUNT_JSON ||
      (process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL && process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY),
  );
}
