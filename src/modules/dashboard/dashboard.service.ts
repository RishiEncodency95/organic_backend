import crypto from "node:crypto";
import dns from "node:dns/promises";
import tls from "node:tls";
import Seo from "../../models/seo.model";
import BlogPost from "../../models/blog/blogPost.model";
import ContactEnquiry from "../../models/contact/contactEnquiry.model";
import BuyerEnquiry from "../../models/contact/buyerEnquiry.model";
import PartnershipEnquiry from "../../models/contact/partnershipEnquiry.model";
import ExhibitorRegistration from "../../models/expo/ExhibitorRegistration.model";
import { PageViewEvent } from "../../models/PageViewEvent.model";
import { env } from "../../config/env";
import { getSiteOrigin } from "../../config/seoSite";

// Import visitor registration dynamically-safe since export style may be named/default
import * as visitorRegModule from "../../models/visitor/visitorRegistration.model";

const VisitorRegistration =
  (visitorRegModule as any).default ||
  (visitorRegModule as any).VisitorRegistration ||
  Object.values(visitorRegModule).find((v: any) => v && typeof v.countDocuments === "function");

export type DashboardRangeKey =
  | "1h"
  | "24h"
  | "7d"
  | "28d"
  | "30d"
  | "90d"
  | "this_month"
  | "prev_month";

export type SourceStatus = "connected" | "not_connected" | "error";

export interface SourceResult<T> {
  status: SourceStatus;
  provider?: string;
  updatedAt: string;
  message?: string;
  data: T | null;
}

const RANGE_LABELS: Record<DashboardRangeKey, string> = {
  "1h": "Last 1 Hour",
  "24h": "Last 24 Hours",
  "7d": "Last 7 Days",
  "28d": "Last 28 Days",
  "30d": "Last 30 Days",
  "90d": "Last 90 Days",
  this_month: "This Month",
  prev_month: "Previous Month",
};

export function parseDashboardRange(raw?: unknown): DashboardRangeKey {
  const key = typeof raw === "string" ? raw.trim().toLowerCase() : "";
  return key in RANGE_LABELS ? (key as DashboardRangeKey) : "7d";
}

function toIsoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function resolveRange(key: DashboardRangeKey) {
  const now = new Date();
  let start: Date;
  let end = new Date(now);
  let prevStart: Date;
  let prevEnd: Date;
  let granularity: "minute" | "hour" | "day" = "day";

  if (key === "1h") {
    granularity = "minute";
    start = new Date(now.getTime() - 60 * 60 * 1000);
    prevEnd = new Date(start.getTime() - 1);
    prevStart = new Date(start.getTime() - 60 * 60 * 1000);
  } else if (key === "24h") {
    granularity = "hour";
    start = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    prevEnd = new Date(start.getTime() - 1);
    prevStart = new Date(start.getTime() - 24 * 60 * 60 * 1000);
  } else if (key === "this_month") {
    start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0));
    const spanMs = Math.max(86_400_000, now.getTime() - start.getTime());
    prevEnd = new Date(start.getTime() - 1);
    prevStart = new Date(prevEnd.getTime() - spanMs);
  } else if (key === "prev_month") {
    start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1, 0, 0, 0, 0));
    end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 0, 23, 59, 59, 999));
    prevStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 2, 1, 0, 0, 0, 0));
    prevEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 0, 23, 59, 59, 999));
  } else {
    const days = key === "28d" ? 28 : key === "30d" ? 30 : key === "90d" ? 90 : 7;
    const ms = days * 24 * 60 * 60 * 1000;
    start = new Date(now.getTime() - ms);
    prevEnd = new Date(start.getTime() - 1);
    prevStart = new Date(start.getTime() - ms);
  }

  const gscEnd = key === "1h" || key === "24h" ? new Date(now.getTime() - 86_400_000) : end;
  const gscDaysSpan =
    key === "1h" || key === "24h"
      ? 2
      : Math.max(1, Math.round((end.getTime() - start.getTime()) / 86_400_000));
  const gscStart =
    key === "this_month" || key === "prev_month"
      ? start
      : new Date(gscEnd.getTime() - gscDaysSpan * 86_400_000);
  const gscPrevEnd = new Date(gscStart.getTime() - 86_400_000);
  const gscPrevStart = new Date(gscPrevEnd.getTime() - gscDaysSpan * 86_400_000);

  return {
    key,
    label: RANGE_LABELS[key],
    start,
    end,
    prevStart,
    prevEnd,
    granularity,
    gaStartDate: toIsoDate(start),
    gaEndDate: toIsoDate(end),
    gaPrevStartDate: toIsoDate(prevStart),
    gaPrevEndDate: toIsoDate(prevEnd),
    gscStartDate: toIsoDate(gscStart),
    gscEndDate: toIsoDate(gscEnd),
    gscPrevStartDate: toIsoDate(gscPrevStart),
    gscPrevEndDate: toIsoDate(gscPrevEnd),
  };
}

function pctChange(curr: number, prev: number): number | null {
  if (!Number.isFinite(prev) || prev <= 0) return null;
  return Number((((curr - prev) / prev) * 100).toFixed(1));
}

function getTargetSiteUrl(): string {
  return (
    env.LIVE_SITE_URL ||
    env.WEBSITE_URL ||
    env.NEXT_PUBLIC_SITE_URL ||
    env.FRONTEND_URL ||
    getSiteOrigin()
  ).replace(/\/+$/, "");
}

function normalizePem(raw: string): string {
  let key = raw.trim();
  if ((key.startsWith('"') && key.endsWith('"')) || (key.startsWith("'") && key.endsWith("'"))) {
    key = key.slice(1, -1);
  }
  return key.replace(/\\r\\n/g, "\n").replace(/\\n/g, "\n").replace(/\r\n/g, "\n");
}

function getServiceAccount(): { email: string; privateKey: string } | null {
  if (env.GSC_SERVICE_ACCOUNT_JSON) {
    try {
      const raw = env.GSC_SERVICE_ACCOUNT_JSON.trim();
      const text = raw.startsWith("{") ? raw : Buffer.from(raw, "base64").toString("utf8");
      const parsed = JSON.parse(text) as { client_email?: string; private_key?: string };
      if (parsed.client_email && parsed.private_key) {
        return { email: parsed.client_email, privateKey: normalizePem(parsed.private_key) };
      }
    } catch {
      // Fall back to split vars
    }
  }
  const email = env.GOOGLE_SERVICE_ACCOUNT_EMAIL?.trim();
  const key = env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY ? normalizePem(env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY) : "";
  if (email && key) return { email, privateKey: key };
  return null;
}

const googleTokenCache = new Map<string, { token: string; expiresAt: number }>();

async function getGoogleToken(scope: string): Promise<string | null> {
  if (
    scope.includes("webmasters") &&
    env.GSC_OAUTH_CLIENT_ID &&
    env.GSC_OAUTH_CLIENT_SECRET &&
    env.GSC_OAUTH_REFRESH_TOKEN
  ) {
    const res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: env.GSC_OAUTH_CLIENT_ID,
        client_secret: env.GSC_OAUTH_CLIENT_SECRET,
        refresh_token: env.GSC_OAUTH_REFRESH_TOKEN,
        grant_type: "refresh_token",
      }),
      signal: AbortSignal.timeout(15_000),
    });
    if (res.ok) {
      const json = (await res.json()) as { access_token?: string };
      if (json.access_token) return json.access_token;
    }
  }

  const sa = getServiceAccount();
  if (!sa) return null;

  const cached = googleTokenCache.get(scope);
  if (cached && cached.expiresAt > Date.now() + 60_000) return cached.token;

  const iat = Math.floor(Date.now() / 1000);
  const b64 = (s: string | Buffer) => Buffer.from(s).toString("base64url");
  const header = b64(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claim = b64(
    JSON.stringify({
      iss: sa.email,
      scope,
      aud: "https://oauth2.googleapis.com/token",
      iat,
      exp: iat + 3600,
    })
  );
  const unsigned = `${header}.${claim}`;
  const sig = crypto.sign("RSA-SHA256", Buffer.from(unsigned), crypto.createPrivateKey(sa.privateKey));
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    signal: AbortSignal.timeout(15_000),
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: `${unsigned}.${b64(sig)}`,
    }),
  });
  const body = (await res.json()) as { access_token?: string; expires_in?: number };
  if (!res.ok || !body.access_token) return null;

  googleTokenCache.set(scope, {
    token: body.access_token,
    expiresAt: Date.now() + (body.expires_in ?? 3600) * 1000,
  });
  return body.access_token;
}

export async function recordPageViewEvent(
  payload: Record<string, unknown>,
  meta: { userAgent?: string; country?: string; city?: string }
): Promise<void> {
  const sessionId =
    typeof payload.sessionId === "string" && payload.sessionId.trim()
      ? payload.sessionId.trim().slice(0, 120)
      : "anon-session";
  const visitorId =
    typeof payload.visitorId === "string" && payload.visitorId.trim()
      ? payload.visitorId.trim().slice(0, 120)
      : sessionId;
  const rawPath = typeof payload.path === "string" ? payload.path.trim() : "/";
  const path = (rawPath.startsWith("/") ? rawPath : `/${rawPath}`).split("?")[0].slice(0, 300) || "/";
  const title = typeof payload.title === "string" ? payload.title.trim().slice(0, 300) : undefined;
  const referrer = typeof payload.referrer === "string" ? payload.referrer.trim().slice(0, 500) : undefined;
  const eventType = typeof payload.eventType === "string" ? payload.eventType : "pageview";
  const durationSeconds =
    typeof payload.durationSeconds === "number" && Number.isFinite(payload.durationSeconds)
      ? Math.max(0, Math.min(86400, Math.round(payload.durationSeconds)))
      : 0;

  if (eventType === "leave" || eventType === "heartbeat") {
    const existing = await PageViewEvent.findOne({ sessionId, path }).sort({ createdAt: -1 });
    if (existing) {
      if (durationSeconds > existing.durationSeconds) existing.durationSeconds = durationSeconds;
      if (durationSeconds >= 10) existing.bounced = false;
      await existing.save();
    }
    return;
  }

  const priorCount = await PageViewEvent.countDocuments({ sessionId });
  if (priorCount > 0) {
    await PageViewEvent.updateMany({ sessionId, bounced: true }, { $set: { bounced: false } });
  }

  const ua = (meta.userAgent ?? "").toLowerCase();
  const deviceType = /ipad|tablet/.test(ua)
    ? "tablet"
    : /mobi|android|iphone/.test(ua)
      ? "mobile"
      : ua
        ? "desktop"
        : "unknown";

  await PageViewEvent.create({
    sessionId,
    visitorId,
    path,
    title,
    referrer,
    userAgent: meta.userAgent?.slice(0, 500),
    country: meta.country,
    city: meta.city,
    deviceType,
    durationSeconds,
    bounced: priorCount === 0,
  });
}

async function fetchCloudflareAnalytics(range: ReturnType<typeof resolveRange>) {
  const token = env.CLOUDFLARE_API_TOKEN;
  const zoneId = env.CLOUDFLARE_ZONE_ID;
  if (!token || !zoneId) return null;

  const isSubDay = range.key === "1h" || range.key === "24h";
  const query = isSubDay
    ? `query($zone: String!, $start: Time!, $end: Time!, $prevStart: Time!, $prevEnd: Time!) {
        viewer { zones(filter: { zoneTag: $zone }) {
          current: httpRequestsAdaptiveGroups(limit: 200, filter: { datetime_geq: $start, datetime_lt: $end }) {
            sum { pageViews requests } uniq { uniques } dimensions { datetimeHour }
          }
          previous: httpRequestsAdaptiveGroups(limit: 200, filter: { datetime_geq: $prevStart, datetime_lt: $prevEnd }) {
            sum { pageViews requests } uniq { uniques }
          }
          topPages: httpRequestsAdaptiveGroups(limit: 8, orderBy: [count_DESC], filter: { datetime_geq: $start, datetime_lt: $end, requestSource: "eyeball" }) {
            count dimensions { clientRequestPath }
          }
        } }
      }`
    : `query($zone: String!, $startDate: Date!, $endDate: Date!, $prevStartDate: Date!, $prevEndDate: Date!, $startIso: Time!, $endIso: Time!) {
        viewer { zones(filter: { zoneTag: $zone }) {
          current: httpRequests1dGroups(limit: 120, orderBy: [date_ASC], filter: { date_geq: $startDate, date_leq: $endDate }) {
            sum { pageViews requests } uniq { uniques } dimensions { date }
          }
          previous: httpRequests1dGroups(limit: 120, filter: { date_geq: $prevStartDate, date_leq: $prevEndDate }) {
            sum { pageViews requests } uniq { uniques }
          }
          topPages: httpRequestsAdaptiveGroups(limit: 8, orderBy: [count_DESC], filter: { datetime_geq: $startIso, datetime_lt: $endIso, requestSource: "eyeball" }) {
            count dimensions { clientRequestPath }
          }
        } }
      }`;

  const variables = isSubDay
    ? {
        zone: zoneId,
        start: range.start.toISOString(),
        end: range.end.toISOString(),
        prevStart: range.prevStart.toISOString(),
        prevEnd: range.prevEnd.toISOString(),
      }
    : {
        zone: zoneId,
        startDate: range.gaStartDate,
        endDate: range.gaEndDate,
        prevStartDate: range.gaPrevStartDate,
        prevEndDate: range.gaPrevEndDate,
        startIso: range.start.toISOString(),
        endIso: range.end.toISOString(),
      };

  const res = await fetch("https://api.cloudflare.com/client/v4/graphql", {
    method: "POST",
    signal: AbortSignal.timeout(15_000),
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query, variables }),
  });
  if (!res.ok) return null;
  const json = (await res.json()) as any;
  const zone = json?.data?.viewer?.zones?.[0];
  if (!zone) return null;

  let users = 0;
  let pageViews = 0;
  const dailyMap = new Map<string, { users: number; pageViews: number }>();
  for (const row of zone.current ?? []) {
    const u = Number(row.uniq?.uniques ?? 0);
    const pv = Number(row.sum?.pageViews ?? row.sum?.requests ?? 0);
    users += u;
    pageViews += pv;
    const key =
      row.dimensions?.datetimeHour?.slice(11, 16) ||
      (row.dimensions?.date ? String(row.dimensions.date).replace(/-/g, "") : "Total");
    const prev = dailyMap.get(key) ?? { users: 0, pageViews: 0 };
    dailyMap.set(key, { users: prev.users + u, pageViews: prev.pageViews + pv });
  }
  const prevUsers = (zone.previous ?? []).reduce((s: number, r: any) => s + Number(r.uniq?.uniques ?? 0), 0);
  const prevPv = (zone.previous ?? []).reduce(
    (s: number, r: any) => s + Number(r.sum?.pageViews ?? r.sum?.requests ?? 0),
    0
  );

  return {
    status: "connected" as const,
    provider: "cloudflare",
    updatedAt: new Date().toISOString(),
    message: `Cloudflare Analytics (${range.label})`,
    data: {
      users,
      sessions: users,
      pageViews,
      averageSessionSeconds: 0,
      bounceRate: 0,
      conversions: 0,
      daily: Array.from(dailyMap.entries()).map(([date, v]) => ({ date, users: v.users, pageViews: v.pageViews })),
      pages: (zone.topPages ?? [])
        .map((p: any) => ({
          path: p.dimensions?.clientRequestPath || "/",
          views: Number(p.count ?? 0),
          visitors: Number(p.count ?? 0),
          averageSessionSeconds: 0,
          bounceRate: 0,
        }))
        .filter((p: any) => p.views > 0 && !p.path.startsWith("/_next") && !p.path.startsWith("/api")),
      growth: {
        users: pctChange(users, prevUsers),
        sessions: pctChange(users, prevUsers),
        pageViews: pctChange(pageViews, prevPv),
        averageSession: null,
        bounceRate: null,
        conversionRate: null,
      },
    },
  };
}

async function fetchGa4Analytics(range: ReturnType<typeof resolveRange>) {
  const propertyId = env.GA4_PROPERTY_ID?.trim();
  if (!propertyId) return null;
  const token = await getGoogleToken("https://www.googleapis.com/auth/analytics.readonly").catch(() => null);
  if (!token) return null;

  if (range.key === "1h") {
    const rtRes = await fetch(
      `https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runRealtimeReport`,
      {
        method: "POST",
        signal: AbortSignal.timeout(15_000),
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          minuteRanges: [{ name: "last60m", startMinutesAgo: 59, endMinutesAgo: 0 }],
          metrics: [{ name: "activeUsers" }, { name: "screenPageViews" }],
          dimensions: [{ name: "unifiedScreenName" }],
          limit: 8,
        }),
      }
    );
    if (rtRes.ok) {
      const rt = (await rtRes.json()) as any;
      const rows = rt.rows ?? [];
      const users = rows.reduce((s: number, r: any) => s + Number(r.metricValues?.[0]?.value ?? 0), 0);
      const pageViews = rows.reduce((s: number, r: any) => s + Number(r.metricValues?.[1]?.value ?? 0), 0);
      return {
        status: "connected" as const,
        provider: "ga4",
        updatedAt: new Date().toISOString(),
        message: "GA4 Realtime (Last 1 Hour)",
        data: {
          users,
          sessions: users,
          pageViews,
          averageSessionSeconds: 0,
          bounceRate: 0,
          conversions: 0,
          daily: [{ date: "Last 1h", users, pageViews }],
          pages: rows.map((r: any) => ({
            path: r.dimensionValues?.[0]?.value || "/",
            views: Number(r.metricValues?.[1]?.value ?? 0),
            visitors: Number(r.metricValues?.[0]?.value ?? 0),
            averageSessionSeconds: 0,
            bounceRate: 0,
          })),
          growth: {
            users: null,
            sessions: null,
            pageViews: null,
            averageSession: null,
            bounceRate: null,
            conversionRate: null,
          },
        },
      };
    }
  }

  const endpoint = `https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runReport`;
  const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
  const timeDim = range.key === "24h" ? "dateHour" : "date";

  const [sumRes, serRes, pageRes] = await Promise.all([
    fetch(endpoint, {
      method: "POST",
      signal: AbortSignal.timeout(15_000),
      headers,
      body: JSON.stringify({
        dateRanges: [
          { startDate: range.gaStartDate, endDate: range.gaEndDate },
          { startDate: range.gaPrevStartDate, endDate: range.gaPrevEndDate },
        ],
        metrics: [
          { name: "totalUsers" },
          { name: "sessions" },
          { name: "screenPageViews" },
          { name: "averageSessionDuration" },
          { name: "bounceRate" },
        ],
      }),
    }),
    fetch(endpoint, {
      method: "POST",
      signal: AbortSignal.timeout(15_000),
      headers,
      body: JSON.stringify({
        dateRanges: [{ startDate: range.gaStartDate, endDate: range.gaEndDate }],
        dimensions: [{ name: timeDim }],
        metrics: [{ name: "totalUsers" }, { name: "screenPageViews" }],
        orderBys: [{ dimension: { dimensionName: timeDim } }],
        limit: 95,
      }),
    }),
    fetch(endpoint, {
      method: "POST",
      signal: AbortSignal.timeout(15_000),
      headers,
      body: JSON.stringify({
        dateRanges: [{ startDate: range.gaStartDate, endDate: range.gaEndDate }],
        dimensions: [{ name: "pagePath" }],
        metrics: [{ name: "screenPageViews" }, { name: "totalUsers" }],
        orderBys: [{ metric: { metricName: "screenPageViews" }, desc: true }],
        limit: 8,
      }),
    }),
  ]);

  if (!sumRes.ok) return null;
  const sumJson = (await sumRes.json()) as any;
  const serJson = serRes.ok ? ((await serRes.json()) as any) : {};
  const pageJson = pageRes.ok ? ((await pageRes.json()) as any) : {};

  const curr = sumJson.rows?.[0]?.metricValues ?? [];
  const prev = sumJson.rows?.[1]?.metricValues ?? [];
  const users = Number(curr[0]?.value ?? 0);
  const sessions = Number(curr[1]?.value ?? 0);
  const pageViews = Number(curr[2]?.value ?? 0);
  const avgSec = Math.round(Number(curr[3]?.value ?? 0));
  const bouncePct = Number((Number(curr[4]?.value ?? 0) * 100).toFixed(1));

  const prevUsers = Number(prev[0]?.value ?? 0);
  const prevSessions = Number(prev[1]?.value ?? 0);
  const prevPv = Number(prev[2]?.value ?? 0);
  const prevAvg = Number(prev[3]?.value ?? 0);
  const prevBounce = Number(prev[4]?.value ?? 0) * 100;

  return {
    status: "connected" as const,
    provider: "ga4",
    updatedAt: new Date().toISOString(),
    message: `Google Analytics 4 (${range.label})`,
    data: {
      users,
      sessions,
      pageViews,
      averageSessionSeconds: avgSec,
      bounceRate: bouncePct,
      conversions: 0,
      daily: (serJson.rows ?? []).map((r: any) => {
        const raw = r.dimensionValues?.[0]?.value ?? "";
        return {
          date: timeDim === "dateHour" && raw.length === 10 ? `${raw.slice(8, 10)}:00` : raw,
          users: Number(r.metricValues?.[0]?.value ?? 0),
          pageViews: Number(r.metricValues?.[1]?.value ?? 0),
        };
      }),
      pages: (pageJson.rows ?? []).map((r: any) => ({
        path: r.dimensionValues?.[0]?.value ?? "/",
        views: Number(r.metricValues?.[0]?.value ?? 0),
        visitors: Number(r.metricValues?.[1]?.value ?? 0),
        averageSessionSeconds: avgSec,
        bounceRate: bouncePct,
      })),
      growth: {
        users: pctChange(users, prevUsers),
        sessions: pctChange(sessions, prevSessions),
        pageViews: pctChange(pageViews, prevPv),
        averageSession: pctChange(avgSec, prevAvg),
        bounceRate: pctChange(bouncePct, prevBounce),
        conversionRate: null,
      },
    },
  };
}

async function fetchTrackerAnalytics(range: ReturnType<typeof resolveRange>) {
  const summarize = async (start: Date, end: Date) => {
    const [totals] = await PageViewEvent.aggregate([
      { $match: { createdAt: { $gte: start, $lte: end } } },
      { $group: { _id: null, pageViews: { $sum: 1 }, visitors: { $addToSet: "$visitorId" } } },
    ]);
    const sessions = await PageViewEvent.aggregate([
      { $match: { createdAt: { $gte: start, $lte: end } } },
      { $group: { _id: "$sessionId", duration: { $sum: "$durationSeconds" }, totalEvents: { $sum: 1 } } },
    ]);
    const users = totals?.visitors?.length ?? 0;
    const pageViews = totals?.pageViews ?? 0;
    const avgSession =
      sessions.length > 0
        ? Math.round(sessions.reduce((s: number, i: any) => s + i.duration, 0) / sessions.length)
        : 0;
    const bounced = sessions.filter((s: any) => s.totalEvents <= 1 && s.duration < 10).length;
    const bounceRate = sessions.length > 0 ? Number(((bounced / sessions.length) * 100).toFixed(1)) : 0;
    return { users, sessions: sessions.length, pageViews, avgSession, bounceRate };
  };

  const bucketFormat =
    range.granularity === "minute"
      ? "%H:%M"
      : range.granularity === "hour"
        ? "%Y-%m-%d %H:00"
        : "%Y%m%d";

  const [curr, prev, topPages, buckets] = await Promise.all([
    summarize(range.start, range.end),
    summarize(range.prevStart, range.prevEnd),
    PageViewEvent.aggregate([
      { $match: { createdAt: { $gte: range.start, $lte: range.end } } },
      { $group: { _id: "$path", views: { $sum: 1 }, visitors: { $addToSet: "$visitorId" } } },
      { $sort: { views: -1 } },
      { $limit: 8 },
    ]),
    PageViewEvent.aggregate([
      { $match: { createdAt: { $gte: range.start, $lte: range.end } } },
      { $group: { _id: { $dateToString: { format: bucketFormat, date: "$createdAt" } }, pageViews: { $sum: 1 }, visitors: { $addToSet: "$visitorId" } } },
      { $sort: { _id: 1 } },
    ]),
  ]);

  let daily: Array<{ date: string; users: number; pageViews: number }>;
  if (buckets.length > 0) {
    daily = buckets.map((b: any) => ({
      date: range.granularity === "hour" ? String(b._id).slice(11, 16) : b._id,
      users: b.visitors.length,
      pageViews: b.pageViews,
    }));
  } else {
    const span = Math.max(60_000, range.end.getTime() - range.start.getTime());
    daily = Array.from({ length: 5 }, (_, idx) => {
      const t = new Date(range.start.getTime() + Math.round((span * idx) / 4));
      return {
        date:
          range.granularity === "minute" || range.granularity === "hour"
            ? t.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false })
            : toIsoDate(t).replace(/-/g, ""),
        users: 0,
        pageViews: 0,
      };
    });
  }

  return {
    status: "connected" as const,
    provider: "tracker",
    updatedAt: new Date().toISOString(),
    message:
      curr.pageViews > 0
        ? `Site Tracker live (${range.label})`
        : `Site Tracker active — no sessions recorded in ${range.label}`,
    data: {
      users: curr.users,
      sessions: curr.sessions,
      pageViews: curr.pageViews,
      averageSessionSeconds: curr.avgSession,
      bounceRate: curr.bounceRate,
      conversions: 0,
      daily,
      pages: topPages.map((p: any) => ({
        path: p._id || "/",
        views: p.views,
        visitors: p.visitors?.length ?? 0,
        averageSessionSeconds: curr.avgSession,
        bounceRate: curr.bounceRate,
      })),
      growth: {
        users: pctChange(curr.users, prev.users),
        sessions: pctChange(curr.sessions, prev.sessions),
        pageViews: pctChange(curr.pageViews, prev.pageViews),
        averageSession: pctChange(curr.avgSession, prev.avgSession),
        bounceRate: pctChange(curr.bounceRate, prev.bounceRate),
        conversionRate: null,
      },
    },
  };
}

async function fetchSearchConsole(range: ReturnType<typeof resolveRange>) {
  const updatedAt = new Date().toISOString();
  const siteUrl = (env.SEARCH_CONSOLE_SITE_URL || env.GSC_SITE_URL || "").trim();
  const token = await getGoogleToken("https://www.googleapis.com/auth/webmasters.readonly").catch(() => null);

  if (!siteUrl || !token) {
    return {
      status: "not_connected" as const,
      updatedAt,
      message:
        "Google Search Console not connected. Configure GOOGLE_SERVICE_ACCOUNT_EMAIL + GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY (or GSC_OAUTH_*) and SEARCH_CONSOLE_SITE_URL in backend .env.",
      data: null,
    };
  }

  try {
    const endpoint = `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(siteUrl)}/searchAnalytics/query`;
    const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
    const run = async (body: Record<string, unknown>) => {
      const res = await fetch(endpoint, {
        method: "POST",
        signal: AbortSignal.timeout(15_000),
        headers,
        body: JSON.stringify(body),
      });
      const json = (await res.json()) as any;
      if (!res.ok || json.error) throw new Error(json.error?.message || `Search Console HTTP ${res.status}`);
      return (json.rows ?? []) as any[];
    };

    const [currTotals, prevTotals, dailyRows, queryRows] = await Promise.all([
      run({ startDate: range.gscStartDate, endDate: range.gscEndDate }),
      run({ startDate: range.gscPrevStartDate, endDate: range.gscPrevEndDate }),
      run({ startDate: range.gscStartDate, endDate: range.gscEndDate, dimensions: ["date"], rowLimit: 95 }),
      run({ startDate: range.gscStartDate, endDate: range.gscEndDate, dimensions: ["query"], rowLimit: 5 }),
    ]);

    const c = currTotals[0] ?? {};
    const p = prevTotals[0] ?? {};
    const clicks = Number(c.clicks ?? 0);
    const impressions = Number(c.impressions ?? 0);
    const ctr = Number(((c.ctr ?? 0) * 100).toFixed(2));
    const position = Number((c.position ?? 0).toFixed(1));

    return {
      status: "connected" as const,
      updatedAt,
      message: `Search Console (${range.gscStartDate} to ${range.gscEndDate})`,
      data: {
        clicks,
        impressions,
        ctr,
        position,
        growth: {
          clicks: pctChange(clicks, Number(p.clicks ?? 0)),
          impressions: pctChange(impressions, Number(p.impressions ?? 0)),
          ctr: pctChange(ctr, Number(((p.ctr ?? 0) * 100).toFixed(2))),
          position: pctChange(position, Number((p.position ?? 0).toFixed(1))),
        },
        daily: dailyRows
          .map((r) => ({
            date: r.keys?.[0] ?? "",
            clicks: Number(r.clicks ?? 0),
            impressions: Number(r.impressions ?? 0),
          }))
          .sort((a, b) => a.date.localeCompare(b.date)),
        queries: queryRows.map((r) => ({
          query: r.keys?.[0] ?? "",
          clicks: Number(r.clicks ?? 0),
          impressions: Number(r.impressions ?? 0),
          ctr: Number(((r.ctr ?? 0) * 100).toFixed(2)),
          position: Number((r.position ?? 0).toFixed(1)),
        })),
      },
    };
  } catch (err: any) {
    return {
      status: "error" as const,
      updatedAt,
      message: err?.message || "Search Console query failed",
      data: null,
    };
  }
}

let cachedPageSpeed: any = null;
let psiInFlight: Promise<any> | null = null;
const PSI_TTL_MS = 15 * 60 * 1000;

async function runPsi(siteUrl: string, strategy: "mobile" | "desktop") {
  const params = new URLSearchParams({ url: siteUrl, strategy });
  params.append("category", "performance");
  if (strategy === "mobile") params.append("category", "seo");
  const key = env.PAGESPEED_API_KEY || env.PSI_API_KEY;
  if (key) params.set("key", key);

  const res = await fetch(`https://www.googleapis.com/pagespeedonline/v5/runPagespeed?${params}`, {
    signal: AbortSignal.timeout(45_000),
  });
  if (!res.ok) return null;
  const json = (await res.json()) as any;
  const audits = json.lighthouseResult?.audits ?? {};
  const field = json.loadingExperience?.metrics ?? {};

  return {
    performanceScore:
      typeof json.lighthouseResult?.categories?.performance?.score === "number"
        ? Math.round(json.lighthouseResult.categories.performance.score * 100)
        : null,
    seoScore:
      typeof json.lighthouseResult?.categories?.seo?.score === "number"
        ? Math.round(json.lighthouseResult.categories.seo.score * 100)
        : null,
    lcp:
      field.LARGEST_CONTENTFUL_PAINT_MS?.percentile ??
      audits["largest-contentful-paint"]?.numericValue ??
      null,
    inp: field.INTERACTION_TO_NEXT_PAINT?.percentile ?? null,
    cls:
      typeof field.CUMULATIVE_LAYOUT_SHIFT_SCORE?.percentile === "number"
        ? field.CUMULATIVE_LAYOUT_SHIFT_SCORE.percentile / 100
        : audits["cumulative-layout-shift"]?.numericValue ?? null,
    fcp: audits["first-contentful-paint"]?.numericValue ?? field.FIRST_CONTENTFUL_PAINT_MS?.percentile ?? null,
    tbt: audits["total-blocking-time"]?.numericValue ?? null,
    ttfb: audits["server-response-time"]?.numericValue ?? field.EXPERIMENTAL_TIME_TO_FIRST_BYTE?.percentile ?? null,
  };
}

async function refreshPageSpeed() {
  const updatedAt = new Date().toISOString();
  const siteUrl = getTargetSiteUrl();

  let html = "";
  let robotsOk = false;
  let sitemapOk = false;
  await Promise.allSettled([
    fetch(siteUrl, { signal: AbortSignal.timeout(10_000) }).then(async (r) => {
      if (r.ok) html = await r.text();
    }),
    fetch(`${siteUrl}/robots.txt`, { signal: AbortSignal.timeout(8_000) }).then(async (r) => {
      if (r.ok && /user-agent/i.test(await r.text())) robotsOk = true;
    }),
    fetch(`${siteUrl}/sitemap.xml`, { signal: AbortSignal.timeout(8_000) }).then(async (r) => {
      if (r.ok && /<urlset|<sitemapindex/i.test(await r.text())) sitemapOk = true;
    }),
  ]);

  const checks = [
    { key: "title", label: "Page title present", status: html ? (/<title[^>]*>[^<]+<\/title>/i.test(html) ? "good" : "needs_work") : "not_checked", score: null },
    { key: "description", label: "Meta description present", status: html ? (/<meta[^>]+name=["']description["'][^>]+content=["'][^"']+/i.test(html) ? "good" : "needs_work") : "not_checked", score: null },
    { key: "canonical", label: "Canonical tag valid", status: html ? (/<link[^>]+rel=["']canonical["'][^>]+href=["'][^"']+/i.test(html) ? "good" : "needs_work") : "not_checked", score: null },
    { key: "og", label: "Open Graph (OG) social tags active", status: html ? (/<meta[^>]+property=["']og:(title|description|image)["'][^>]+content=["'][^"']+/i.test(html) ? "good" : "needs_work") : "not_checked", score: null },
    { key: "h1-schema", label: "H1 & JSON-LD structured data", status: html ? (/<h1[\s>]/i.test(html) && /application\/ld\+json/i.test(html) ? "good" : "needs_work") : "not_checked", score: null },
    { key: "robots-sitemap", label: "Robots.txt & XML sitemap accessible", status: robotsOk && sitemapOk ? "good" : "needs_work", score: null },
  ];
  const fallbackScore = html ? Math.round((checks.filter((c) => c.status === "good").length / checks.length) * 100) : 0;

  const [mobileRes, desktopRes] = await Promise.all([
    runPsi(siteUrl, "mobile").catch(() => null),
    runPsi(siteUrl, "desktop").catch(() => null),
  ]);

  const res = {
    status: "connected" as const,
    updatedAt,
    message: mobileRes || desktopRes ? "PageSpeed Insights live" : "Live HTML SEO checks (PSI pending/unavailable)",
    data: {
      strategy: "mobile" as const,
      lighthouseAvailable: Boolean(mobileRes || desktopRes),
      performanceScore: mobileRes?.performanceScore ?? 0,
      seoScore: mobileRes?.seoScore ?? fallbackScore,
      lcp: mobileRes?.lcp ?? null,
      inp: mobileRes?.inp ?? null,
      cls: mobileRes?.cls ?? null,
      fcp: mobileRes?.fcp ?? null,
      ttfb: mobileRes?.ttfb ?? null,
      tbt: mobileRes?.tbt ?? null,
      desktop: desktopRes,
      mobile: mobileRes,
      seoChecks: checks,
    },
  };
  cachedPageSpeed = res;
  return res;
}

export async function getPageSpeedSnapshot(force = false) {
  if (!force && cachedPageSpeed && Date.now() - new Date(cachedPageSpeed.updatedAt).getTime() < PSI_TTL_MS) {
    return cachedPageSpeed;
  }
  if (!psiInFlight) {
    psiInFlight = refreshPageSpeed().finally(() => {
      psiInFlight = null;
    });
  }
  return psiInFlight;
}

let cachedIndex: any = null;
let indexInFlight: Promise<any> | null = null;

async function countSitemap(url: string, depth = 0): Promise<{ valid: boolean; count: number }> {
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(10_000) });
    if (!r.ok) return { valid: false, count: 0 };
    const xml = await r.text();
    if (/<sitemapindex/i.test(xml) && depth < 1) {
      const locs = Array.from(xml.matchAll(/<loc>([^<]+)<\/loc>/gi)).map((m) => m[1].trim()).slice(0, 6);
      const children = await Promise.all(locs.map((u) => countSitemap(u, depth + 1)));
      return { valid: true, count: children.reduce((s, c) => s + c.count, 0) };
    }
    return { valid: /<urlset|<sitemapindex/i.test(xml), count: (xml.match(/<loc>/gi) || []).length };
  } catch {
    return { valid: false, count: 0 };
  }
}

async function refreshIndexCoverage() {
  const updatedAt = new Date().toISOString();
  const siteUrl = getTargetSiteUrl();
  const gscSite = (env.SEARCH_CONSOLE_SITE_URL || env.GSC_SITE_URL || "").trim();

  const [sitemapProbe, robotsOk, token] = await Promise.all([
    countSitemap(`${siteUrl}/sitemap.xml`),
    fetch(`${siteUrl}/robots.txt`, { signal: AbortSignal.timeout(8_000) })
      .then(async (r) => r.ok && /user-agent/i.test(await r.text()))
      .catch(() => false),
    gscSite ? getGoogleToken("https://www.googleapis.com/auth/webmasters.readonly").catch(() => null) : Promise.resolve(null),
  ]);

  let submitted = sitemapProbe.valid ? sitemapProbe.count : 0;
  let indexed: number | null = null;
  let errors: number | null = null;
  const gscConnected = Boolean(gscSite && token);

  if (gscConnected && token) {
    try {
      const r = await fetch(
        `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(gscSite)}/sitemaps`,
        { signal: AbortSignal.timeout(12_000), headers: { Authorization: `Bearer ${token}` } }
      );
      if (r.ok) {
        const j = (await r.json()) as any;
        let subSum = 0;
        let idxSum = 0;
        let errSum = 0;
        for (const sm of j.sitemap ?? []) {
          errSum += Number(sm.errors ?? 0);
          for (const c of sm.contents ?? []) {
            subSum += Number(c.submitted ?? 0);
            idxSum += Number(c.indexed ?? 0);
          }
        }
        if (subSum > 0) submitted = subSum;
        if (idxSum > 0 || (j.sitemap?.length ?? 0) > 0) indexed = idxSum;
        errors = errSum;
      }
    } catch {}
  }

  const res = {
    status: "connected" as const,
    updatedAt,
    message: gscConnected ? "Sitemap + Search Console synced" : "Live Sitemap (GSC not connected)",
    data: {
      total: submitted,
      indexed: indexed ?? 0,
      notIndexed: errors ?? 0,
      submittedPages: sitemapProbe.valid ? submitted : null,
      indexedPages: indexed,
      crawlErrors: errors,
      sitemapUrlCount: sitemapProbe.valid ? sitemapProbe.count : null,
      sitemapValid: sitemapProbe.valid,
      robotsValid: robotsOk,
      gscConnected,
      urls: [],
    },
  };
  cachedIndex = res;
  return res;
}

export function getIndexCoverageSnapshot(force = false) {
  if (!force && cachedIndex && Date.now() - new Date(cachedIndex.updatedAt).getTime() < PSI_TTL_MS) {
    return cachedIndex;
  }
  if (!indexInFlight) {
    indexInFlight = refreshIndexCoverage().finally(() => {
      indexInFlight = null;
    });
  }
  return (
    cachedIndex ?? {
      status: "connected",
      updatedAt: new Date().toISOString(),
      message: "Checking live sitemap...",
      data: {
        total: 0,
        indexed: 0,
        notIndexed: 0,
        submittedPages: null,
        indexedPages: null,
        crawlErrors: null,
        sitemapUrlCount: null,
        sitemapValid: null,
        robotsValid: null,
        gscConnected: false,
        urls: [],
      },
    }
  );
}

let cachedSiteStatus: any = null;
let siteInFlight: Promise<any> | null = null;

async function refreshSiteStatus() {
  const updatedAt = new Date().toISOString();
  const siteUrl = getTargetSiteUrl();
  const parsed = new URL(siteUrl);
  const started = Date.now();

  const tlsInfo = await (parsed.protocol === "https:"
    ? new Promise<{ sslValid: boolean; issuer: string | null; days: number | null; expiresAt: string | null }>(
        (resolve) => {
          const sock = tls.connect({ host: parsed.hostname, port: 443, servername: parsed.hostname, timeout: 6000 }, () => {
            try {
              const cert = sock.getPeerCertificate();
              const vt = cert?.valid_to ? new Date(cert.valid_to) : null;
              const days = vt ? Math.floor((vt.getTime() - Date.now()) / 86_400_000) : null;
              const rawIssuer = cert?.issuer?.O || cert?.issuer?.CN || null;
              const issuer = Array.isArray(rawIssuer) ? (rawIssuer[0] ?? null) : rawIssuer;
              sock.end();
              resolve({
                sslValid: sock.authorized || (days != null && days >= 0),
                issuer,
                days,
                expiresAt: vt ? vt.toISOString() : null,
              });
            } catch {
              sock.end();
              resolve({ sslValid: false, issuer: null, days: null, expiresAt: null });
            }
          });
          sock.on("error", () => resolve({ sslValid: false, issuer: null, days: null, expiresAt: null }));
          sock.on("timeout", () => {
            sock.destroy();
            resolve({ sslValid: false, issuer: null, days: null, expiresAt: null });
          });
        }
      )
    : Promise.resolve({ sslValid: false, issuer: null, days: null, expiresAt: null }));

  const [ipAddr, httpRes] = await Promise.all([
    dns.lookup(parsed.hostname).then((r) => r.address).catch(() => null),
    fetch(siteUrl, { signal: AbortSignal.timeout(10_000), redirect: "follow" }).catch(() => null),
  ]);

  const responseTimeMs = Date.now() - started;
  const headersList = [
    "strict-transport-security",
    "content-security-policy",
    "x-frame-options",
    "x-content-type-options",
    "referrer-policy",
    "permissions-policy",
  ];
  const present = headersList.filter((h) => Boolean(httpRes?.headers?.get(h))).length;

  const res = {
    status: httpRes ? ("connected" as const) : ("error" as const),
    updatedAt,
    message: httpRes ? `Live check (${responseTimeMs}ms)` : "Unable to reach site",
    data: {
      online: Boolean(httpRes?.ok),
      responseTimeMs,
      httpStatus: httpRes?.status ?? 0,
      sslValid: tlsInfo.sslValid,
      sslExpiresAt: tlsInfo.expiresAt,
      sslIssuer: tlsInfo.issuer,
      certificateDaysRemaining: tlsInfo.days,
      finalUrl: httpRes?.url ?? siteUrl,
      redirected: Boolean(httpRes?.redirected),
      ipAddress: ipAddr,
      securityHeaders: { present, total: headersList.length },
      nodeVersion: process.version,
    },
  };
  cachedSiteStatus = res;
  return res;
}

export function getSiteStatusSnapshot(force = false) {
  if (!force && cachedSiteStatus && Date.now() - new Date(cachedSiteStatus.updatedAt).getTime() < 120_000) {
    return cachedSiteStatus;
  }
  if (!siteInFlight) {
    siteInFlight = refreshSiteStatus().finally(() => {
      siteInFlight = null;
    });
  }
  return (
    cachedSiteStatus ?? {
      status: "connected",
      updatedAt: new Date().toISOString(),
      message: "Checking site health...",
      data: {
        online: false,
        responseTimeMs: 0,
        httpStatus: 0,
        sslValid: false,
        sslExpiresAt: null,
        sslIssuer: null,
        certificateDaysRemaining: null,
        finalUrl: getTargetSiteUrl(),
        redirected: false,
        ipAddress: null,
        securityHeaders: { present: 0, total: 6 },
        nodeVersion: process.version,
      },
    }
  );
}

async function fetchInternalMetrics(range: ReturnType<typeof resolveRange>, visitorsCount: number) {
  const dateFilter = { createdAt: { $gte: range.start, $lte: range.end } };
  const prevFilter = { createdAt: { $gte: range.prevStart, $lte: range.prevEnd } };

  const [
    seoPagesCount,
    publishedPostsCount,
    currContactCount,
    prevContactCount,
    currBuyerCount,
    prevBuyerCount,
    currPartnerCount,
    prevPartnerCount,
    currExhibitorCount,
    prevExhibitorCount,
    currVisitorCount,
    prevVisitorCount,
    recentContacts,
    recentBuyers,
    recentPartners,
    recentExhibitors,
    recentVisitors,
    buyerCities,
    partnerCities,
    exhibitorCities,
    visitorCities,
  ] = await Promise.all([
    Seo.countDocuments({ isActive: true }).catch(() => 0),
    BlogPost.countDocuments({ status: "published" }).catch(() => 0),
    ContactEnquiry.countDocuments(dateFilter).catch(() => 0),
    ContactEnquiry.countDocuments(prevFilter).catch(() => 0),
    BuyerEnquiry.countDocuments(dateFilter).catch(() => 0),
    BuyerEnquiry.countDocuments(prevFilter).catch(() => 0),
    PartnershipEnquiry.countDocuments(dateFilter).catch(() => 0),
    PartnershipEnquiry.countDocuments(prevFilter).catch(() => 0),
    ExhibitorRegistration.countDocuments(dateFilter).catch(() => 0),
    ExhibitorRegistration.countDocuments(prevFilter).catch(() => 0),
    VisitorRegistration ? VisitorRegistration.countDocuments(dateFilter).catch(() => 0) : Promise.resolve(0),
    VisitorRegistration ? VisitorRegistration.countDocuments(prevFilter).catch(() => 0) : Promise.resolve(0),
    ContactEnquiry.find(dateFilter).sort({ createdAt: -1 }).limit(6).lean().catch(() => []),
    BuyerEnquiry.find(dateFilter).sort({ createdAt: -1 }).limit(6).lean().catch(() => []),
    PartnershipEnquiry.find(dateFilter).sort({ createdAt: -1 }).limit(6).lean().catch(() => []),
    ExhibitorRegistration.find(dateFilter).sort({ createdAt: -1 }).limit(6).lean().catch(() => []),
    VisitorRegistration
      ? VisitorRegistration.find(dateFilter).sort({ createdAt: -1 }).limit(6).lean().catch(() => [])
      : Promise.resolve([]),
    BuyerEnquiry.aggregate([
      { $match: { ...dateFilter, city: { $nin: [null, ""] } } },
      { $group: { _id: "$city", count: { $sum: 1 } } },
    ]).catch(() => []),
    PartnershipEnquiry.aggregate([
      { $match: { ...dateFilter, city: { $nin: [null, ""] } } },
      { $group: { _id: "$city", count: { $sum: 1 } } },
    ]).catch(() => []),
    ExhibitorRegistration.aggregate([
      { $match: { ...dateFilter, city: { $nin: [null, ""] } } },
      { $group: { _id: "$city", count: { $sum: 1 } } },
    ]).catch(() => []),
    VisitorRegistration
      ? VisitorRegistration.aggregate([
          { $match: { ...dateFilter, city: { $nin: [null, ""] } } },
          { $group: { _id: "$city", count: { $sum: 1 } } },
        ]).catch(() => [])
      : Promise.resolve([]),
  ]);

  const totalEnquiries =
    currContactCount + currBuyerCount + currPartnerCount + currExhibitorCount + currVisitorCount;
  const previousEnquiries =
    prevContactCount + prevBuyerCount + prevPartnerCount + prevExhibitorCount + prevVisitorCount;

  const cityMap = new Map<string, number>();
  for (const row of [...buyerCities, ...partnerCities, ...exhibitorCities, ...visitorCities]) {
    const c = String(row?._id || "").trim();
    if (!c) continue;
    cityMap.set(c, (cityMap.get(c) ?? 0) + Number(row.count ?? 0));
  }
  const topLocations = Array.from(cityMap.entries())
    .map(([city, count]) => ({ city, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  const recentSubmissions = [
    ...recentContacts.map((e: any) => ({
      id: String(e._id),
      name: e.name || "Contact Enquiry",
      type: e.service || e.subject || "Contact Enquiry",
      city: e.city,
      createdAt: new Date(e.createdAt).toISOString(),
    })),
    ...recentBuyers.map((e: any) => ({
      id: String(e._id),
      name: e.name || e.company || "Buyer Enquiry",
      type: "Buyer Enquiry",
      city: e.city,
      createdAt: new Date(e.createdAt).toISOString(),
    })),
    ...recentPartners.map((e: any) => ({
      id: String(e._id),
      name: e.name || e.organization || "Partnership / Sponsor",
      type: e.category || "Sponsorship",
      city: e.city,
      createdAt: new Date(e.createdAt).toISOString(),
    })),
    ...recentExhibitors.map((e: any) => ({
      id: String(e._id),
      name: e.exhibitorName || "Exhibitor Booking",
      type: "Exhibitor",
      city: e.city,
      createdAt: new Date(e.createdAt).toISOString(),
    })),
    ...recentVisitors.map((e: any) => ({
      id: String(e._id),
      name: e.name || e.companyName || "Visitor",
      type: `Visitor (${e.category || "general"})`,
      city: e.city,
      createdAt: new Date(e.createdAt).toISOString(),
    })),
  ]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 8);

  const conversionRate =
    visitorsCount > 0 ? Number(((totalEnquiries / visitorsCount) * 100).toFixed(2)) : null;

  return {
    status: "connected" as const,
    updatedAt: new Date().toISOString(),
    message: `Database synced (${range.label})`,
    data: {
      totalPages: seoPagesCount,
      totalPosts: publishedPostsCount,
      totalEnquiries,
      enquiriesMtd: totalEnquiries,
      previousEnquiries,
      totalRequests: currExhibitorCount + currVisitorCount,
      conversionRate,
      growth: {
        posts: null,
        enquiriesMtd: pctChange(totalEnquiries, previousEnquiries),
      },
      recentSubmissions,
      topLocations,
      actionRequired: {
        exhibitor: currExhibitorCount,
        buyer: currBuyerCount,
        sponsor: currPartnerCount,
        visitor: currVisitorCount,
      },
    },
  };
}

export async function buildDashboardOverview(
  rangeKey: DashboardRangeKey = "7d",
  options: { forceRefresh?: boolean } = {}
) {
  const range = resolveRange(rangeKey);
  const force = Boolean(options.forceRefresh);

  if (!cachedPageSpeed && !force) {
    void getPageSpeedSnapshot(false);
  }

  const cfOrGa = async () => {
    const cf = await fetchCloudflareAnalytics(range).catch(() => null);
    if (cf) return cf;
    const ga = await fetchGa4Analytics(range).catch(() => null);
    if (ga) return ga;
    return fetchTrackerAnalytics(range);
  };

  const [analytics, searchConsole, pageSpeed] = await Promise.all([
    cfOrGa(),
    fetchSearchConsole(range),
    force
      ? getPageSpeedSnapshot(true)
      : Promise.resolve(
          cachedPageSpeed ?? {
            status: "connected",
            updatedAt: new Date().toISOString(),
            message: "Checking PageSpeed...",
            data: null,
          }
        ),
  ]);

  const visitorsCount = analytics.data?.users ?? 0;
  const internal = await fetchInternalMetrics(range, visitorsCount);
  const indexCoverage = force ? await refreshIndexCoverage() : getIndexCoverageSnapshot(false);
  const siteStatus = force ? await refreshSiteStatus() : getSiteStatusSnapshot(false);

  return {
    generatedAt: new Date().toISOString(),
    range: {
      key: range.key,
      label: range.label,
      start: range.start.toISOString(),
      end: range.end.toISOString(),
      granularity: range.granularity,
    },
    sources: {
      internal,
      analytics,
      searchConsole,
      pageSpeed,
      indexCoverage,
      siteStatus,
    },
  };
}
