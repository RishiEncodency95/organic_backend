import crypto from "node:crypto";
import { SITE_SCOPE, CompetitorKeyword } from "../../models/competitorAnalyzer";
import { CompetitorGoogleConnection } from "../../models/competitorAnalyzer/config.model";
import { buildKeywordRecord } from "./analysis/keywords";
import { AnalyzerError } from "./errors";
import { analyzerConfig } from "./config";
import { buildAuthUrl, decryptToken, emailFromIdToken, encryptToken, exchangeCode, oauthConfig, refreshAccessToken, revokeToken, signState, verifyState, GSC_SCOPE } from "./providers/googleOAuth";
import { fetchSummary, gscUnavailable, listSites, type GscSummary } from "./providers/searchConsole";

/*
 * Own-site Google Search Console connection (Engine 6 measured data). Only our property; never competitors.
 * Public API surface never includes the refresh token, nonce or raw Google responses.
 */

type FetchLike = typeof fetch;
let fetchImpl: FetchLike = (...a) => fetch(...a);
export const setGoogleFetch = (f: FetchLike) => {
  fetchImpl = f;
};

export async function googleStatus() {
  const cfg = oauthConfig();
  const c = await CompetitorGoogleConnection.findOne({ siteScope: SITE_SCOPE }).lean<any>();
  return {
    configured: !!cfg,
    redirectUri: cfg?.redirectUri ?? null,
    status: !cfg ? "not_configured" : c?.status === "connected" ? "connected" : c?.status === "revoked" || c?.status === "error" ? c.status : "not_connected",
    email: c?.status === "connected" ? c.email : null,
    property: c?.property ?? null,
    connectedAt: c?.connectedAt ?? null,
    lastSyncAt: c?.lastSyncAt ?? null,
    lastSync: c?.lastSync ? { period: c.lastSync.period, totals: c.lastSync.totals, queries: c.lastSync.queries?.length ?? 0, pages: c.lastSync.pages?.length ?? 0 } : null,
    lastError: c?.lastError ?? null,
  };
}

export async function startConnect(userId: string) {
  const cfg = oauthConfig();
  if (!cfg) throw new AnalyzerError(503, "PROVIDER_UNAVAILABLE", "Google OAuth is not configured (GOOGLE_OAUTH_CLIENT_ID / SECRET / REDIRECT_URI)");
  const nonce = crypto.randomBytes(16).toString("hex");
  await CompetitorGoogleConnection.updateOne({ siteScope: SITE_SCOPE }, { $set: { pendingNonce: nonce, pendingBy: userId }, $setOnInsert: { status: "pending" } }, { upsert: true });
  return { url: buildAuthUrl(cfg, signState(userId, nonce)) };
}

/** OAuth callback (no JWT: Google redirects the browser). Trust comes from the signed, single-use state. */
export async function handleCallback(q: { code?: string; state?: string; error?: string }) {
  const cfg = oauthConfig();
  if (!cfg) throw new AnalyzerError(503, "PROVIDER_UNAVAILABLE", "Google OAuth is not configured");
  if (q.error) throw new AnalyzerError(400, "PROVIDER_UNAVAILABLE", `Google sign-in was not completed: ${String(q.error).slice(0, 80)}`);
  const state = verifyState(String(q.state ?? ""));
  if (!state || !q.code) throw new AnalyzerError(400, "INVALID_URL", "Invalid or expired sign-in state");
  // Single use: the nonce must match the pending one and is cleared atomically.
  const claimed = await CompetitorGoogleConnection.findOneAndUpdate({ siteScope: SITE_SCOPE, pendingNonce: state.nonce }, { $set: { pendingNonce: null } }, { returnDocument: "after" }).lean<any>();
  if (!claimed) throw new AnalyzerError(400, "INVALID_URL", "This sign-in link was already used or replaced");
  const tokens = await exchangeCode(cfg, String(q.code), fetchImpl);
  if (!tokens.scope?.includes(GSC_SCOPE)) throw new AnalyzerError(400, "PROVIDER_UNAVAILABLE", "Search Console read access was not granted");
  if (!tokens.refresh_token && !claimed.refreshTokenEnc) throw new AnalyzerError(400, "PROVIDER_UNAVAILABLE", "Google did not return a refresh token; remove the app's access in your Google account and connect again");
  const old = claimed.refreshTokenEnc ? safeDecrypt(claimed.refreshTokenEnc) : null;
  await CompetitorGoogleConnection.updateOne(
    { siteScope: SITE_SCOPE },
    { $set: { status: "connected", refreshTokenEnc: tokens.refresh_token ? encryptToken(tokens.refresh_token) : claimed.refreshTokenEnc, scope: tokens.scope, email: emailFromIdToken(tokens.id_token), connectedBy: state.uid, connectedAt: new Date(), lastError: null } },
  );
  if (old && tokens.refresh_token && old !== tokens.refresh_token) await revokeToken(old, fetchImpl);
  return googleStatus();
}

function safeDecrypt(blob: string) {
  try {
    return decryptToken(blob);
  } catch {
    return null;
  }
}

async function accessToken(): Promise<{ token: string; property: string | null }> {
  const cfg = oauthConfig();
  const c = await CompetitorGoogleConnection.findOne({ siteScope: SITE_SCOPE }).lean<any>();
  if (!cfg || c?.status !== "connected" || !c.refreshTokenEnc) throw new AnalyzerError(409, "PROVIDER_UNAVAILABLE", "Google Search Console is not connected");
  const refresh = safeDecrypt(c.refreshTokenEnc);
  if (!refresh) {
    await CompetitorGoogleConnection.updateOne({ siteScope: SITE_SCOPE }, { $set: { status: "error", lastError: "Stored token could not be decrypted (encryption secret changed?). Connect again." } });
    throw new AnalyzerError(409, "PROVIDER_UNAVAILABLE", "Stored Google token is unreadable; connect again");
  }
  try {
    return { token: await refreshAccessToken(cfg, refresh, fetchImpl), property: c.property ?? null };
  } catch (e: any) {
    await CompetitorGoogleConnection.updateOne({ siteScope: SITE_SCOPE }, { $set: { status: e?.revoked ? "revoked" : "connected", lastError: String(e?.message ?? e).slice(0, 300) } });
    throw new AnalyzerError(502, "PROVIDER_UNAVAILABLE", String(e?.message ?? "Google token refresh failed"));
  }
}

export async function listProperties() {
  const { token } = await accessToken();
  return (await listSites(token, fetchImpl)).filter((s) => propertyMatchesSite(s.siteUrl, analyzerConfig().primarySiteUrl));
}

export function propertyMatchesSite(property: string, siteUrl: string): boolean {
  try {
    const site = new URL(siteUrl);
    if (property.startsWith("sc-domain:")) {
      const domain = property.slice(10).toLowerCase();
      return !!domain && (site.hostname === domain || site.hostname.endsWith(`.${domain}`));
    }
    const prefix = new URL(property);
    return ["http:", "https:"].includes(prefix.protocol) && site.origin === prefix.origin && site.pathname.startsWith(prefix.pathname);
  } catch { return false; }
}

export async function setProperty(property: string) {
  if (!propertyMatchesSite(property, analyzerConfig().primarySiteUrl)) throw new AnalyzerError(400, "INVALID_URL", "Choose a Search Console property for the Moksha Voyage website");
  const sites = await listProperties();
  if (!sites.some((s) => s.siteUrl === property)) throw new AnalyzerError(400, "INVALID_URL", "That property is not available to the connected Google account");
  await CompetitorGoogleConnection.updateOne({ siteScope: SITE_SCOPE }, { $set: { property } });
  return googleStatus();
}

export async function disconnect() {
  const c = await CompetitorGoogleConnection.findOne({ siteScope: SITE_SCOPE }).lean<any>();
  const t = c?.refreshTokenEnc ? safeDecrypt(c.refreshTokenEnc) : null;
  if (t) await revokeToken(t, fetchImpl);
  await CompetitorGoogleConnection.updateOne({ siteScope: SITE_SCOPE }, { $set: { status: "revoked", refreshTokenEnc: null, email: null, lastError: null, pendingNonce: null } });
  return googleStatus();
}

/** Own-property summary for a run report. Never throws: unavailable states are explicit. */
export async function ownSearchSummary(siteUrl = analyzerConfig().primarySiteUrl): Promise<GscSummary> {
  if (!oauthConfig()) return gscUnavailable("not_connected", "Google OAuth not configured");
  const c = await CompetitorGoogleConnection.findOne({ siteScope: SITE_SCOPE }).select("status property").lean<any>();
  if (c?.status !== "connected") return gscUnavailable("not_connected", "Search Console not connected");
  if (!c.property) return gscUnavailable("no_property", "No Search Console property selected");
  if (!propertyMatchesSite(c.property, siteUrl) || !propertyMatchesSite(c.property, analyzerConfig().primarySiteUrl)) return gscUnavailable("no_property", "Selected property does not match the own website; choose the Moksha Voyage property");
  try {
    const { token } = await accessToken();
    return await fetchSummary(token, c.property, { fetchImpl });
  } catch (e) {
    return gscUnavailable("failed", (e as Error).message.slice(0, 300), c.property);
  }
}

/** Pulls the latest 28-day window into the keyword store (measured, own property). */
export async function syncSearchConsole() {
  const summary = await ownSearchSummary();
  if (summary.state !== "measured") throw new AnalyzerError(409, "PROVIDER_UNAVAILABLE", summary.error ?? `Search Console ${summary.state}`);
  let upserted = 0;
  for (const row of summary.queries) {
    const rec = buildKeywordRecord(row.key, "gsc");
    if (!rec) continue;
    const gsc = { clicks: row.clicks, impressions: row.impressions, ctr: row.ctr, position: row.position, period: summary.period, property: summary.property, measuredAt: summary.measuredAt, source: "google_search_console" };
    await CompetitorKeyword.updateOne(
      { siteScope: SITE_SCOPE, normalized: rec.normalized },
      {
        $setOnInsert: { siteScope: SITE_SCOPE, normalized: rec.normalized, keyword: rec.keyword, language: rec.language, intent: rec.intent, cluster: rec.cluster, serviceCategory: rec.serviceCategory, city: rec.city, isQuestion: rec.isQuestion, metrics: { searchVolume: "not_available", difficulty: "not_available", cpc: "not_available", position: "not_available" } },
        $addToSet: { sources: "gsc" },
        $set: { gsc },
      },
      { upsert: true },
    );
    // History: one entry per 28-day window (re-syncing the same window does not duplicate it).
    await CompetitorKeyword.updateOne(
      { siteScope: SITE_SCOPE, normalized: rec.normalized, "gscHistory.start": { $ne: summary.period!.start } },
      { $push: { gscHistory: { $each: [{ ...summary.period, clicks: row.clicks, impressions: row.impressions, position: row.position }], $slice: -26 } } },
    );
    upserted += 1;
  }
  await CompetitorGoogleConnection.updateOne(
    { siteScope: SITE_SCOPE },
    { $set: { lastSyncAt: new Date(), lastSync: { period: summary.period, totals: summary.totals, queries: summary.queries.slice(0, 100), pages: summary.pages.slice(0, 50) }, lastError: null } },
  );
  return { property: summary.property, period: summary.period, totals: summary.totals, keywords: upserted, pages: summary.pages.length, note: "Measured Search Console data for your own property. Impressions are not search volume." };
}
