/**
 * Per-page insights for the admin's SEO audit, all from real data:
 *   - headings: every H1–H6 of each page in the order the page has them, with what is wrong with the order
 *   - social share tags: Open Graph and X / Twitter card values (saved and live), editable, with history and Undo
 *   - keywords of any address: the words and phrases a page really uses, and where it uses them
 *   - AI pictures: proof written inside a picture file, and an AI model's estimate (always labelled as an estimate)
 * Nothing is invented: what cannot be measured is said to be unavailable.
 */
import { createHash } from "crypto";
import SeoAuditSnapshot from "../../models/seoAudit.model";
import SeoFixLog from "../../models/seoFixLog.model";
import AiImageCheck from "../../models/AiImageCheck.model";
import KeywordAnalysis from "../../models/KeywordAnalysis.model";
import Seo from "../../models/seo.model";
import { SitePage } from "../../models/sitePages/SitePage.model";
import { env } from "../../config/env";
import { getCrawlerUserAgent, getSiteName, getSiteOrigin, isAuditedOrigin } from "../../config/seoSite";
import { safeFetch } from "../../utils/ssrf";
import { logger } from "../../utils/logger";
import { clearDeliveryCache } from "../seo/deliveryCache";
import { rebuildWebsite } from "../../utils/rebuildWebsite";
import { parseHtml, type CrawlResult, type HttpFetchResult } from "./crawler.service";
import { readSitePageSeo, sitePageKeyForPath, writeSitePageSeo } from "./pageSeoStore";
import { toAbsoluteUrl, toCleanPath, generateAiJson, aiAvailable } from "./seoAutoFix.service";
import { fenceUntrusted } from "./seoAiContent.service";
import { AI_LIKELY, VISION_VERSION, NOT_AI_KINDS, readAiCheck } from "./aiImageEvidence";
import { getSiteDescription } from "../../config/seoSite";
import { pageKeyOf } from "./canonicalUtil";

export class InsightError extends Error {
  constructor(message: string, public status = 400) {
    super(message);
  }
}

const cleanPath = (p: string): string => (p.split(/[?#]/)[0].replace(/\/+$/, "") || "/").toLowerCase();

async function latestCrawls(): Promise<{ crawls: CrawlResult[]; auditedAt: string | null }> {
  const snap: any = await SeoAuditSnapshot.findOne().sort({ createdAt: -1 }).select("crawls createdAt").lean();
  return { crawls: ((snap?.crawls as CrawlResult[]) || []).filter((c) => c && c.ok), auditedAt: snap?.createdAt ? new Date(snap.createdAt).toISOString() : null };
}

async function crawlOf(route: string): Promise<{ crawl: CrawlResult | null; auditedAt: string | null }> {
  const { crawls, auditedAt } = await latestCrawls();
  const want = cleanPath(route);
  return { crawl: crawls.find((c) => cleanPath(c.requestedPath || "/") === want) ?? null, auditedAt };
}

// ─── Headings ───────────────────────────────────────────────────────────────

export interface HeadingRow {
  level: number;
  text: string;
  /** What is wrong with this heading where it stands (empty when nothing) */
  issues: string[];
}

export interface PageHeadings {
  route: string;
  title: string;
  counts: Record<"h1" | "h2" | "h3" | "h4" | "h5" | "h6", number>;
  total: number;
  headings: HeadingRow[];
  /** Problems of the page as a whole */
  problems: string[];
  ok: boolean;
  h1Override?: string | null;
  awaitingDeploy?: boolean;
}

/** The headings of one page, in page order, checked: one H1, the H1 first, no skipped level, no repeated heading. */
export function auditHeadings(
  route: string,
  title: string,
  sequence: Array<{ level: number; text: string }>,
  dbH1?: string | null,
  dbExtraTag?: string | null
): PageHeadings {
  let adjusted = sequence.map((h) => ({ level: h.level, text: h.text.replace(/\s+/g, " ").trim(), issues: [] as string[] }));
  let awaitingDeploy = false;

  if (dbH1 && dbH1.trim()) {
    const targetH1 = dbH1.trim();
    const extraTagLevel = dbExtraTag === "h3" ? 3 : 2;
    let replacedH1 = false;
    adjusted = adjusted.map((h) => {
      if (h.level === 1) {
        if (!replacedH1) {
          replacedH1 = true;
          return { level: 1, text: targetH1, issues: [] };
        } else {
          return { level: extraTagLevel, text: h.text, issues: [] };
        }
      }
      return h;
    });
    if (!replacedH1) {
      adjusted.unshift({ level: 1, text: targetH1, issues: [] });
    }
    awaitingDeploy = true;
  }

  const counts = { h1: 0, h2: 0, h3: 0, h4: 0, h5: 0, h6: 0 };
  for (const h of adjusted) counts[`h${h.level}` as keyof typeof counts] += 1;

  const problems: string[] = [];
  if (counts.h1 === 0) problems.push("The page has no H1 (main heading).");
  if (counts.h1 > 1) problems.push(`The page has ${counts.h1} H1 headings; a page needs exactly one.`);
  if (adjusted.length && adjusted[0].level !== 1 && counts.h1 > 0) problems.push(`The first heading is an H${adjusted[0].level}; the H1 should come first.`);

  let prev = 0;
  adjusted.forEach((h, i) => {
    if (h.level === 1 && counts.h1 > 1) h.issues.push("One of several H1s");
    // going deeper may only go one level at a time (H2 → H3, not H2 → H4); going back up any number of levels is fine
    if (i > 0 && h.level > prev + 1) h.issues.push(`Skips a level: comes after an H${prev}, so it should be an H${prev + 1}`);
    if (i === 0 && h.level > 2) h.issues.push(`The page starts at H${h.level}`);
    if (h.level === 1 && h.text.length > 70) h.issues.push(`Long H1 (${h.text.length} characters)`);
    prev = h.level;
  });
  const skipped = adjusted.filter((h) => h.issues.some((x) => x.startsWith("Skips a level"))).length;
  if (skipped) problems.push(`${skipped} heading${skipped === 1 ? " skips" : "s skip"} a level (the order should go H1 → H2 → H3 … without jumping).`);

  const seen = new Map<string, number>();
  for (const h of adjusted) {
    const k = `${h.level}|${h.text.toLowerCase()}`;
    seen.set(k, (seen.get(k) ?? 0) + 1);
  }
  const repeated = [...seen.entries()].filter(([, n]) => n > 1);
  for (const h of adjusted) {
    const n = seen.get(`${h.level}|${h.text.toLowerCase()}`) ?? 0;
    if (n > 1) h.issues.push(`The same H${h.level} text appears ${n} times`);
  }
  if (repeated.length) problems.push(`${repeated.length} heading text${repeated.length === 1 ? " is" : "s are"} repeated at the same level.`);

  return {
    route,
    title,
    counts,
    total: adjusted.length,
    headings: adjusted,
    problems,
    ok: problems.length === 0,
    h1Override: dbH1?.trim() || null,
    awaitingDeploy,
  };
}

export async function headingsReport(): Promise<{ auditedAt: string | null; pages: PageHeadings[] }> {
  const { crawls, auditedAt } = await latestCrawls();

  const [seoDocs, sitePages] = await Promise.all([
    Seo.find({}).select("page h1Heading h1ExtraTag").lean(),
    SitePage.find({}).select("key seo.h1Heading seo.h1ExtraTag").lean(),
  ]);
  const h1ByKey = new Map<string, { h1Heading?: string; h1ExtraTag?: string }>();
  for (const d of seoDocs as any[]) {
    if (d.page && typeof d.h1Heading === "string" && d.h1Heading.trim()) {
      h1ByKey.set(String(d.page), { h1Heading: d.h1Heading, h1ExtraTag: d.h1ExtraTag });
    }
  }
  for (const p of sitePages as any[]) {
    if (p.key && typeof p.seo?.h1Heading === "string" && p.seo.h1Heading.trim()) {
      h1ByKey.set(String(p.key), { h1Heading: p.seo.h1Heading, h1ExtraTag: p.seo.h1ExtraTag });
    }
  }

  const pages = crawls
    .filter((c) => (c.httpStatus ?? 200) < 400)
    .map((c) => {
      const route = c.requestedPath || "/";
      const pk = pageKeyOf(route);
      const h1Info = h1ByKey.get(pk);
      return auditHeadings(route, c.title || "", c.headingSequence ?? [], h1Info?.h1Heading, h1Info?.h1ExtraTag);
    });
  return { auditedAt, pages };
}

// ─── Social share tags (Open Graph, X / Twitter) ────────────────────────────

export const SOCIAL_FIELDS = ["ogTitle", "ogDescription", "ogImage", "ogImageAlt", "twitterCard", "twitterTitle", "twitterDescription", "twitterImage"] as const;
export type SocialField = (typeof SOCIAL_FIELDS)[number];
export type SocialInput = Partial<Record<SocialField, string>>;

/** Lengths the share previews show in full (Facebook / WhatsApp / LinkedIn / X) */
export const SOCIAL_LIMITS = { ogTitle: 60, ogDescription: 160, twitterTitle: 70, twitterDescription: 200, ogImageAlt: 125 } as const;

const pickSocial = (seo: Record<string, any>): Record<SocialField, string> =>
  Object.fromEntries(SOCIAL_FIELDS.map((f) => [f, typeof seo?.[f] === "string" ? seo[f] : ""])) as Record<SocialField, string>;

export async function getSocial(route: string) {
  const path = toCleanPath(route);
  const key = sitePageKeyForPath(path);
  const { crawl, auditedAt } = await crawlOf(path);
  const seo = key ? await readSitePageSeo(key) : {};
  const saved = pickSocial(seo);
  const live = {
    ogTitle: crawl?.openGraph?.["og:title"] ?? null,
    ogDescription: crawl?.openGraph?.["og:description"] ?? null,
    ogImage: crawl?.openGraph?.["og:image"] ?? null,
    ogImageAlt: crawl?.openGraph?.["og:image:alt"] ?? null,
    twitterCard: crawl?.twitter?.["twitter:card"] ?? null,
    twitterTitle: crawl?.twitter?.["twitter:title"] ?? null,
    twitterDescription: crawl?.twitter?.["twitter:description"] ?? null,
    twitterImage: crawl?.twitter?.["twitter:image"] ?? null,
  };
  // what the website writes into the page from the saved values (the same order as the website's lib/seo.ts)
  const metaTitle = String(seo.metaTitle || "").trim() || crawl?.title || "";
  const metaDescription = String(seo.metaDescription || "").trim() || crawl?.metaDescription || "";
  const ogTitle = saved.ogTitle.trim() || metaTitle;
  const ogDescription = saved.ogDescription.trim() || metaDescription;
  const ogImage = saved.ogImage.trim() || live.ogImage || "";
  const effective = {
    ogTitle,
    ogDescription,
    ogImage,
    ogImageAlt: saved.ogImageAlt.trim() || ogTitle,
    twitterCard: saved.twitterCard.trim() || "summary_large_image",
    twitterTitle: saved.twitterTitle.trim() || ogTitle,
    twitterDescription: saved.twitterDescription.trim() || ogDescription,
    twitterImage: saved.twitterImage.trim() || ogImage,
  };
  const checks: Array<{ ok: boolean; text: string }> = [
    { ok: Boolean(effective.ogTitle), text: effective.ogTitle ? `Share title: ${effective.ogTitle.length} characters${effective.ogTitle.length > SOCIAL_LIMITS.ogTitle ? ` (over ${SOCIAL_LIMITS.ogTitle}, it may be cut off)` : ""}` : "No share title" },
    { ok: Boolean(effective.ogDescription) && effective.ogDescription.length <= SOCIAL_LIMITS.ogDescription, text: effective.ogDescription ? `Share description: ${effective.ogDescription.length} characters${effective.ogDescription.length > SOCIAL_LIMITS.ogDescription ? ` (over ${SOCIAL_LIMITS.ogDescription}, it may be cut off)` : ""}` : "No share description" },
    { ok: /^https:\/\//i.test(effective.ogImage), text: effective.ogImage ? (/^https:\/\//i.test(effective.ogImage) ? "Share picture set (https)" : "The share picture must be a full https:// address") : "No share picture: links shared on WhatsApp / Facebook / X show no image" },
    { ok: effective.ogTitle.length <= SOCIAL_LIMITS.ogTitle, text: `Share title fits (${SOCIAL_LIMITS.ogTitle} characters or fewer)` },
    { ok: Boolean(saved.ogImageAlt.trim()), text: saved.ogImageAlt.trim() ? "The share picture has a description" : "The share picture has no description of its own (the share title is used)" },
  ];
  return {
    route: path,
    pageUrl: toAbsoluteUrl(path),
    editable: Boolean(key),
    note: key ? null : "This page's SEO is not kept in Pages & CMS, so its share tags cannot be edited here.",
    saved,
    live,
    effective,
    checks,
    limits: SOCIAL_LIMITS,
    auditedAt,
  };
}

const isWebAddress = (v: string) => /^https?:\/\/[^\s]+$/i.test(v);

/** Saves the share tags of one page (only the fields sent), logged with a snapshot so the Fix history can undo it. */
export async function saveSocial(route: string, input: SocialInput, user: string) {
  const path = toCleanPath(route);
  const key = sitePageKeyForPath(path);
  if (!key) throw new InsightError("This page's SEO is not kept in Pages & CMS, so its share tags cannot be edited here.", 404);

  const next: Partial<Record<SocialField, string>> = {};
  for (const f of SOCIAL_FIELDS) {
    if (input[f] === undefined) continue;
    const v = String(input[f] ?? "").replace(/\s+/g, " ").trim();
    if (/<[a-z!/][^>]*>/i.test(v)) throw new InsightError(`${f} must be plain text, not HTML.`);
    if ((f === "ogImage" || f === "twitterImage") && v && !isWebAddress(v)) throw new InsightError(`${f} must be a full web address (https://…).`);
    if (f === "twitterCard" && v && v !== "summary" && v !== "summary_large_image") throw new InsightError("twitterCard must be summary or summary_large_image.");
    const max = f === "ogImage" || f === "twitterImage" ? 1000 : f === "ogDescription" || f === "twitterDescription" ? 300 : 200;
    if (v.length > max) throw new InsightError(`${f} is longer than ${max} characters.`);
    next[f] = v;
  }
  if (!Object.keys(next).length) throw new InsightError("Nothing to save.");

  const current = pickSocial(await readSitePageSeo(key));
  const before: Record<string, string> = {};
  const after: Record<string, string> = {};
  for (const [f, v] of Object.entries(next) as Array<[SocialField, string]>) {
    if (current[f] === v) continue;
    before[f] = current[f];
    after[f] = v;
  }
  if (!Object.keys(after).length) return { changed: false, logId: null };

  const log: any = await SeoFixLog.create({
    pageUrl: toAbsoluteUrl(path),
    route: path,
    issueType: "og",
    previousValue: before,
    newValue: after,
    fixedBy: user,
    status: "failed",
    errorReason: "not completed",
    snapshot: { before, after },
  });
  try {
    await writeSitePageSeo(key, after, user);
    await SeoFixLog.updateOne({ _id: log._id }, { $set: { status: "applied" }, $unset: { errorReason: 1 } });
  } catch (err: any) {
    await SeoFixLog.updateOne({ _id: log._id }, { $set: { errorReason: String(err?.message).slice(0, 300) } });
    throw err;
  }
  clearDeliveryCache();
  rebuildWebsite();
  return { changed: true, logId: String(log._id) };
}

// ─── Fetching a page or a picture ───────────────────────────────────────────

/** GET with up to 4 redirects. The audited site itself is fetched directly; any other address goes through the SSRF guard. */
async function fetchFollow(url: string, timeoutMs: number): Promise<{ res: Response; finalUrl: string; redirects: Array<{ url: string; status: number }> }> {
  let current = url;
  const redirects: Array<{ url: string; status: number }> = [];
  for (let hop = 0; hop < 5; hop++) {
    const headers = { "User-Agent": getCrawlerUserAgent(), Accept: "*/*" };
    const res = isAuditedOrigin(current)
      ? await fetch(current, { headers, redirect: "manual", signal: AbortSignal.timeout(timeoutMs) })
      : await safeFetch(current, { headers, timeoutMs });
    const location = res.headers.get("location");
    if (res.status >= 300 && res.status < 400 && location) {
      redirects.push({ url: current, status: res.status });
      current = new URL(location, current).toString();
      continue;
    }
    return { res, finalUrl: current, redirects };
  }
  throw new InsightError("Too many redirects.");
}

async function readBytes(res: Response, max: number): Promise<Buffer> {
  const reader = res.body?.getReader();
  if (!reader) return Buffer.alloc(0);
  const chunks: Buffer[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done || !value) break;
    total += value.length;
    if (total > max) {
      await reader.cancel().catch(() => undefined);
      throw new InsightError(`The file is larger than ${Math.round(max / 1024 / 1024)} MB.`);
    }
    chunks.push(Buffer.from(value));
  }
  return Buffer.concat(chunks);
}

// ─── Keywords of an address ─────────────────────────────────────────────────

const STOPWORDS = new Set(
  (
    "a about above after again all also am an and any are as at be because been before being below between both but by can could did do does doing down during each few for from further had has have having he her here hers him his how i if in into is it its itself just me more most my no nor not now of off on once only or other our ours out over own same she should so some such than that the their theirs them then there these they this those through to too under until up very was we were what when where which while who whom why will with would you your yours us get got may might must shall upon via per etc ki ka ke se hai hain aur ko mein par bhi ek yeh woh jo kya"
  ).split(" "),
);
const WEB_NOISE = new Set("click read more learn view home menu close open submit call email phone next previous back skip cookie cookies privacy terms copyright rights reserved".split(" "));

export interface KeywordRow {
  keyword: string;
  words: number;
  count: number;
  /** Share of the page's words taken by this phrase, in % */
  density: number;
  inTitle: boolean;
  inDescription: boolean;
  inH1: boolean;
  inH2: boolean;
  inUrl: boolean;
}

/** The phrases a page really uses (1 to 3 words), ranked by use and by where they appear (title, description, headings, address). */
export function keywordsOf(crawl: Pick<CrawlResult, "title" | "metaDescription" | "h1" | "h2" | "h3" | "bodyText" | "url">, limit = 30): { totalWords: number; keywords: KeywordRow[] } {
  const norm = (s: string) => s.toLowerCase().replace(/[’']/g, "");
  const tokensOf = (s: string) => norm(s).split(/[^a-z0-9ऀ-ॿ]+/).filter(Boolean);
  const body = tokensOf(crawl.bodyText || "");
  const totalWords = body.length;
  const keep = (w: string) => w.length > 2 && !STOPWORDS.has(w) && !WEB_NOISE.has(w) && !/^\d+$/.test(w);

  const counts = new Map<string, number>();
  for (let i = 0; i < body.length; i++) {
    for (let n = 1; n <= 3 && i + n <= body.length; n++) {
      const gram = body.slice(i, i + n);
      if (!keep(gram[0]) || !keep(gram[n - 1])) continue;
      if (gram.some((w) => /^\d+$/.test(w))) continue;
      const k = gram.join(" ");
      counts.set(k, (counts.get(k) ?? 0) + 1);
    }
  }

  const title = norm(crawl.title || "");
  const desc = norm(crawl.metaDescription || "");
  const h1 = norm((crawl.h1 || []).join(" | "));
  const h2 = norm([...(crawl.h2 || []), ...(crawl.h3 || [])].join(" | "));
  let urlText = "";
  try {
    urlText = norm(decodeURIComponent(new URL(crawl.url).pathname)).replace(/[-_/]+/g, " ");
  } catch {
    /* no address */
  }
  const has = (hay: string, k: string) => new RegExp(`(^|[^a-z0-9\\u0900-\\u097f])${k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}($|[^a-z0-9\\u0900-\\u097f])`).test(hay);

  const rows: Array<KeywordRow & { score: number }> = [];
  for (const [k, count] of counts) {
    const words = k.split(" ").length;
    const row = { keyword: k, words, count, density: totalWords ? Math.round(((count * words) / totalWords) * 10000) / 100 : 0, inTitle: has(title, k), inDescription: has(desc, k), inH1: has(h1, k), inH2: has(h2, k), inUrl: has(urlText, k) };
    if (count < 2 && !row.inTitle && !row.inH1) continue;
    const score = count * (1 + (words - 1) * 0.6) + (row.inTitle ? 6 : 0) + (row.inH1 ? 5 : 0) + (row.inDescription ? 3 : 0) + (row.inH2 ? 2 : 0) + (row.inUrl ? 2 : 0);
    rows.push({ ...row, score });
  }
  rows.sort((a, b) => b.score - a.score);
  // a shorter phrase that only ever appears inside a longer kept one adds nothing
  const picked: KeywordRow[] = [];
  for (const r of rows) {
    if (picked.length >= limit) break;
    if (picked.some((p) => p.words > r.words && p.keyword.includes(r.keyword) && p.count >= r.count)) continue;
    const { score: _score, ...row } = r;
    picked.push(row);
  }
  return { totalWords, keywords: picked };
}

const KEYWORD_ANALYSIS_VERSION = 1;
const INTENTS = ["Informational", "Commercial", "Transactional", "Navigational"] as const;

export interface KeywordVariation {
  keyword: string;
  searchVolume: number;
  difficulty: number;
  cpc: number;
  intent: string;
  competition: string;
  /** The keyword's words are all on the page (measured) */
  onPage: boolean;
  /** How many times the whole phrase is written on the page (measured) */
  usedOnPage: number;
}

/** One keyword row from the model, or null when it is not a usable row. Missing numbers are never filled in. */
export function cleanVariation(k: any, bodyLower: string): KeywordVariation | null {
  if (!k || typeof k.keyword !== "string") return null;
  const keyword: string = k.keyword.replace(/\s+/g, " ").trim().toLowerCase();
  if (keyword.length < 3 || keyword.length > 80 || keyword.split(" ").length > 8) return null;
  // a missing value (null, "", undefined) must stay missing: Number(null) is 0, which would be an invented number
  const num = (v: unknown): number => (typeof v === "number" || (typeof v === "string" && v.trim() !== "") ? Number(v) : NaN);
  const volume = num(k.searchVolume);
  const difficulty = num(k.difficulty);
  const cpc = num(k.cpc);
  if (![volume, difficulty, cpc].every(Number.isFinite) || volume <= 0) return null;
  const intent = INTENTS.find((i) => i.toLowerCase() === String(k.intent ?? "").toLowerCase());
  const competition = String(k.competition ?? "").toUpperCase();
  if (!intent || !["LOW", "MEDIUM", "HIGH"].includes(competition)) return null;
  const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const usedOnPage = (bodyLower.match(new RegExp(`(^|[^a-z0-9])${escaped}($|[^a-z0-9])`, "g")) || []).length;
  const onPage = keyword.split(" ").every((w) => bodyLower.includes(w));
  return { keyword, searchVolume: Math.round(volume), difficulty: Math.max(0, Math.min(100, Math.round(difficulty))), cpc: Math.round(cpc * 10) / 10, intent, competition, onPage, usedOnPage };
}

/** The AI's keyword analysis of one page: saved per page text, asked again only when the page changed or `refresh` */
async function analyseKeywordsOfPage(
  finalUrl: string,
  crawl: CrawlResult,
  measured: KeywordRow[],
  refresh: boolean,
): Promise<{ available: boolean; cached: boolean; analysedAt: string | null; message: string | null; primaryRecommendation: string | null; lsiKeywords: string[]; variations: KeywordVariation[] }> {
  const empty = { available: false, cached: false, analysedAt: null as string | null, message: null as string | null, primaryRecommendation: null as string | null, lsiKeywords: [] as string[], variations: [] as KeywordVariation[] };
  const text = [crawl.title, crawl.metaDescription, ...(crawl.h1 || []), ...(crawl.h2 || []), crawl.bodyText].join("\n").slice(0, 30000);
  const contentHash = createHash("sha256").update(text).digest("hex");

  if (!refresh) {
    const saved: any = await KeywordAnalysis.findOne({ url: finalUrl, contentHash, version: KEYWORD_ANALYSIS_VERSION }).lean();
    if (saved) {
      return { available: true, cached: true, analysedAt: new Date(saved.analysedAt).toISOString(), message: null, primaryRecommendation: saved.primaryRecommendation ?? null, lsiKeywords: saved.lsiKeywords ?? [], variations: saved.variations ?? [] };
    }
  }
  if (!aiAvailable()) {
    return { ...empty, message: "No AI key is configured (OPENAI_API_KEY or GEMINI_API_KEY), so the keyword analysis cannot run. The words measured from the page are shown below." };
  }

  const bodyLower = (crawl.bodyText || "").toLowerCase();
  const used = measured.slice(0, 25).map((k) => `${k.keyword} (${k.count}x)`).join(", ");
  const ask = async (already: string[]) => {
    const prompt = `You are an SEO keyword analyst for ${getSiteName()} (${getSiteDescription()}).
Analyse this live web page and list the search keywords a visitor would type to find it.
URL: ${finalUrl}
Title: ${crawl.title || ""}
Meta description: ${crawl.metaDescription || ""}
H1: ${(crawl.h1 || []).join(" | ")}
H2: ${(crawl.h2 || []).slice(0, 10).join(" | ")}
Phrases the page already uses (measured, with how often): ${used || "(few)"}
Page text:
${fenceUntrusted((crawl.bodyText || "").slice(0, 3500))}
${already.length ? `\nAlready listed, do NOT repeat: ${already.join(", ")}\n` : ""}
Return ${already.length ? "more keywords, 12 to 15" : "25 keywords"}: real search queries of 2 to 6 words (long-tail and related searches included), in the page's language mix (English or Hinglish as people really type). No keyword that is only the brand name.
For each: keyword; searchVolume (your estimate of monthly searches in India, a whole number); difficulty (0-100); cpc (estimated INR); intent ("Informational" | "Commercial" | "Transactional" | "Navigational"); competition ("LOW" | "MEDIUM" | "HIGH").
Also: primaryRecommendation (the single best target keyword for THIS page, one of the keywords) and lsiKeywords (5 to 8 related terms).
These numbers are estimates. If you cannot estimate a keyword, leave it out.
Return strictly valid JSON: {"primaryRecommendation": string, "lsiKeywords": string[], "keywordVariations": [{"keyword": string, "searchVolume": number, "difficulty": number, "cpc": number, "intent": string, "competition": string}]}`;
    return generateAiJson(prompt, 40000);
  };

  let primary: string | null = null;
  let lsi: string[] = [];
  const rows = new Map<string, KeywordVariation>();
  for (let attempt = 0; attempt < 3 && rows.size < 20; attempt++) {
    let out: any = null;
    try {
      out = await ask([...rows.keys()]);
    } catch (err: any) {
      logger.warn(`[Keywords URL] AI keyword analysis failed: ${err.message}`);
    }
    if (!out || typeof out !== "object") continue;
    if (!primary && typeof out.primaryRecommendation === "string" && out.primaryRecommendation.trim()) primary = out.primaryRecommendation.trim().toLowerCase();
    if (!lsi.length && Array.isArray(out.lsiKeywords)) lsi = out.lsiKeywords.filter((x: unknown): x is string => typeof x === "string").map((x: string) => x.trim().toLowerCase()).filter(Boolean).slice(0, 10);
    for (const raw of Array.isArray(out.keywordVariations) ? out.keywordVariations : []) {
      const v = cleanVariation(raw, bodyLower);
      if (v && !rows.has(v.keyword)) rows.set(v.keyword, v);
    }
  }
  const variations = [...rows.values()].slice(0, 30);
  if (!variations.length) return { ...empty, message: "The AI model did not return a usable keyword analysis this time. Nothing is shown instead of made-up numbers; press Analyse again." };

  const analysedAt = new Date();
  await KeywordAnalysis.findOneAndUpdate(
    { url: finalUrl, contentHash, version: KEYWORD_ANALYSIS_VERSION },
    { $set: { primaryRecommendation: primary, lsiKeywords: lsi, variations, analysedAt } },
    { upsert: true },
  );
  return {
    available: true,
    cached: false,
    analysedAt: analysedAt.toISOString(),
    message: variations.length < 20 ? `The AI model returned only ${variations.length} usable keywords for this page.` : null,
    primaryRecommendation: primary,
    lsiKeywords: lsi,
    variations,
  };
}

export async function keywordsForUrl(raw: string, opts: { refresh?: boolean } = {}) {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    throw new InsightError("Enter a full web address, for example https://mokshavoyage.in/about-us");
  }
  if (!/^https?:$/.test(url.protocol)) throw new InsightError("Only http:// and https:// addresses can be read.");
  let fetched: Awaited<ReturnType<typeof fetchFollow>>;
  try {
    fetched = await fetchFollow(url.toString(), 20000);
  } catch (err: any) {
    throw new InsightError(`The page could not be read: ${err?.message || "no answer"}`, 422);
  }
  const { res, finalUrl, redirects } = fetched;
  if (res.status >= 400) throw new InsightError(`The page answered ${res.status}, so there is nothing to read.`, 422);
  const type = res.headers.get("content-type") || "";
  if (!/html/i.test(type)) throw new InsightError(`The address is not a web page (${type || "unknown type"}).`, 422);
  const body = (await readBytes(res, 5 * 1024 * 1024)).toString("utf8");
  const result: HttpFetchResult = {
    requestedUrl: url.toString(), finalUrl, status: res.status, headers: {}, body, transferredBytes: body.length, uncompressedBytes: body.length,
    encoding: "identity", ttfbMs: 0, totalMs: 0, redirects, httpVersion: "1.1",
  };
  const crawl = parseHtml(new URL(finalUrl).pathname || "/", result);
  const { totalWords, keywords } = keywordsOf(crawl);

  // The AI's analysis of this page, saved in the database. Nothing is filled in when the AI cannot answer.
  const analysis = await analyseKeywordsOfPage(finalUrl, crawl, keywords, opts.refresh === true);

  return {
    url: finalUrl,
    title: crawl.title || "",
    metaDescription: crawl.metaDescription || "",
    h1: crawl.h1,
    wordCount: totalWords,
    /** Measured from the page itself */
    keywords,
    primaryRecommendation: analysis.primaryRecommendation,
    lsiKeywords: analysis.lsiKeywords,
    keywordVariations: analysis.variations,
    ai: { available: analysis.available, cached: analysis.cached, analysedAt: analysis.analysedAt, message: analysis.message },
    searchVolume: {
      available: analysis.variations.length > 0,
      estimated: true,
      note: analysis.variations.length
        ? "Volume, difficulty and CPC are an AI model's estimates for this page's topic, not measured search data. The 'Used on the page' columns are measured from the page's own text."
        : analysis.message || "No AI analysis is available for this page.",
    },
  };
}

// ─── AI pictures ─────────────────────────────────────────────────────────────

/** Proof written inside a picture file that it was made (or partly made) by AI, or that it carries Content Credentials */
export function metadataSignalsOf(buf: Buffer): { signals: string[]; provenAi: boolean } {
  // metadata sits in the file's header blocks; the first 512 KB is searched as text
  const head = buf.subarray(0, 512 * 1024).toString("latin1");
  const signals: string[] = [];
  let provenAi = false;
  if (/compositeWithTrainedAlgorithmicMedia/i.test(head)) {
    signals.push("IPTC/C2PA: partly made by AI (compositeWithTrainedAlgorithmicMedia)");
    provenAi = true;
  } else if (/trainedAlgorithmicMedia/i.test(head)) {
    signals.push("IPTC/C2PA: made by AI (trainedAlgorithmicMedia)");
    provenAi = true;
  }
  const generators: Array<[RegExp, string]> = [
    [/\bMidjourney\b/i, "Midjourney"],
    [/\bDALL[·\-\s]?E\b/i, "DALL·E"],
    [/\bStable[\s_-]?Diffusion\b/i, "Stable Diffusion"],
    [/\bAdobe Firefly\b/i, "Adobe Firefly"],
    [/\bLeonardo\.Ai\b/i, "Leonardo.Ai"],
    [/\bIdeogram\b/i, "Ideogram"],
    [/\bImagen\b/, "Google Imagen"],
  ];
  for (const [re, name] of generators) {
    if (re.test(head)) {
      signals.push(`Names an AI image generator in its metadata: ${name}`);
      provenAi = true;
    }
  }
  if (/c2pa/i.test(head) && /jumb/i.test(head)) signals.push("Carries Content Credentials (C2PA)");
  return { signals, provenAi };
}

const VISION_PROMPT = `You look at one picture from a business website. Estimate how likely it is that it was GENERATED by an AI image model (Midjourney, DALL-E, Stable Diffusion, Firefly and similar).
Rules:
- Being "not a camera photo" does NOT make a picture AI-made. A banner, layout, logo, icon, chart, screenshot or illustration made in a design tool is a designed graphic: give it a LOW number unless it shows the typical signs of an AI generator.
- Typical signs of AI generation: garbled or melted text, hands or fingers that are wrong, impossible or merged objects, over-smooth glossy skin or surfaces, inconsistent lighting or shadows, repeated patterns that do not make sense, a dreamlike look.
- Name what you actually see; do not guess about how it was made.
Answer with strictly valid JSON: {"likelihood": number 0-100, "kind": "photo" | "illustration" | "icon" | "logo" | "graphic" | "screenshot", "reasons": [up to 3 short reasons: the signs you saw, or why there are none]}.
Use values near 50 only when you truly cannot tell.`;

async function visionEstimate(buf: Buffer, contentType: string): Promise<{ likelihood: number | null; kind: string | null; reasons: string[]; model: string | null; error: string | null }> {
  const mime = contentType.split(";")[0].trim().toLowerCase();
  if (!/^image\/(png|jpe?g|webp|gif)$/.test(mime)) return { likelihood: null, kind: null, reasons: [], model: null, error: `The AI model cannot read ${mime || "this format"} pictures.` };
  const parse = (raw: any) => {
    const l = Number(raw?.likelihood);
    return {
      likelihood: Number.isFinite(l) ? Math.max(0, Math.min(100, Math.round(l))) : null,
      kind: typeof raw?.kind === "string" ? raw.kind.slice(0, 20) : null,
      reasons: Array.isArray(raw?.reasons) ? raw.reasons.filter((r: unknown) => typeof r === "string").map((r: string) => r.slice(0, 160)).slice(0, 3) : [],
    };
  };
  const b64 = buf.toString("base64");
  if (env.OPENAI_API_KEY) {
    try {
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${env.OPENAI_API_KEY}` },
        body: JSON.stringify({
          model: env.OPENAI_MODEL,
          messages: [{ role: "user", content: [{ type: "text", text: VISION_PROMPT }, { type: "image_url", image_url: { url: `data:${mime};base64,${b64}`, detail: "low" } }] }],
          response_format: { type: "json_object" },
        }),
        signal: AbortSignal.timeout(45000),
      });
      if (res.ok) {
        const data: any = await res.json();
        const out = parse(JSON.parse(data?.choices?.[0]?.message?.content || "{}"));
        if (out.likelihood !== null) return { ...out, model: `OpenAI ${env.OPENAI_MODEL}`, error: null };
      } else {
        logger.warn(`[AI images] OpenAI answered ${res.status}`);
      }
    } catch (err: any) {
      logger.warn(`[AI images] OpenAI failed: ${err.message}`);
    }
  }
  if (env.GEMINI_API_KEY) {
    try {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(env.GEMINI_MODEL)}:generateContent`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": env.GEMINI_API_KEY },
        body: JSON.stringify({ contents: [{ role: "user", parts: [{ text: VISION_PROMPT }, { inline_data: { mime_type: mime, data: b64 } }] }], generationConfig: { responseMimeType: "application/json" } }),
        signal: AbortSignal.timeout(45000),
      });
      if (res.ok) {
        const data: any = await res.json();
        const out = parse(JSON.parse(data?.candidates?.[0]?.content?.parts?.[0]?.text || "{}"));
        if (out.likelihood !== null) return { ...out, model: `Gemini ${env.GEMINI_MODEL}`, error: null };
      }
    } catch (err: any) {
      logger.warn(`[AI images] Gemini failed: ${err.message}`);
    }
  }
  return { likelihood: null, kind: null, reasons: [], model: null, error: env.OPENAI_API_KEY || env.GEMINI_API_KEY ? "The AI model did not answer." : "No AI key is configured, so only the file's metadata was checked." };
}

export { AI_LIKELY, VISION_VERSION, NOT_AI_KINDS, readAiCheck };

export interface AiImageRow {
  src: string;
  alt: string;
  status: "checked" | "skipped" | "failed";
  reason?: string;
  bytes?: number;
  metadataSignals: string[];
  provenAi: boolean;
  likelihood: number | null;
  kind: string | null;
  reasons: string[];
  model: string | null;
  cached: boolean;
}

/**
 * Checks the pictures of one page (the latest audit's list). A picture already checked (same bytes) is not sent to the
 * AI model again unless `force`. At most `limit` pictures per run.
 */
/** Pictures smaller than this are icons and badges, not pictures an AI image model would make: they are not sent to the AI model */
const MIN_JUDGED_BYTES = 10 * 1024;

export async function checkPageImages(route: string, opts: { limit?: number; force?: boolean } = {}) {
  const path = toCleanPath(route);
  const { crawl, auditedAt } = await crawlOf(path);
  if (!crawl) throw new InsightError("This page is not in the latest audit. Run an audit first.", 404);
  const limit = Math.max(1, Math.min(40, opts.limit ?? 20));

  const seen = new Set<string>();
  const candidates: Array<{ src: string; alt: string }> = [];
  let skippedDecorative = 0;
  let skippedVector = 0;
  for (const img of crawl.images || []) {
    if (!img.src || img.src.startsWith("data:")) continue;
    let abs: string;
    try {
      abs = new URL(img.src, crawl.url).toString();
    } catch {
      continue;
    }
    // a resized copy (/_next/image?url=…) is the same picture as its original
    try {
      const u = new URL(abs);
      if (u.pathname.startsWith("/_next/image") && u.searchParams.get("url")) abs = new URL(u.searchParams.get("url") as string, abs).toString();
    } catch {
      /* keep as is */
    }
    if (seen.has(abs)) continue;
    seen.add(abs);
    if (img.isDecorative) {
      skippedDecorative += 1;
      continue;
    }
    if (/\.svg(\?|$)/i.test(abs)) {
      skippedVector += 1;
      continue;
    }
    candidates.push({ src: abs, alt: img.alt || "" });
  }
  // Pictures already checked (current question) come from the database without being opened again. Only the rest count
  // against the limit, so pressing "check" again moves on to the next pictures instead of repeating the first ones.
  const doneBySrc = new Map<string, any>();
  if (!opts.force && candidates.length) {
    const done: any[] = await AiImageCheck.find({ src: { $in: candidates.map((c) => c.src) }, visionVersion: { $gte: VISION_VERSION } }).lean();
    // a saved answer, or a saved "icon-sized, not judged"
    for (const d of done) if (d.visionLikelihood !== null || d.visionKind === "icon") doneBySrc.set(d.src, d);
  }
  const todo = candidates.filter((c) => !doneBySrc.has(c.src));
  const fromDatabase = candidates.filter((c) => doneBySrc.has(c.src));
  const batch = [...todo.slice(0, limit), ...fromDatabase];

  const rows: AiImageRow[] = new Array(batch.length);
  let next = 0;
  const worker = async () => {
    while (next < batch.length) {
      const i = next++;
      const { src, alt } = batch[i];
      const base: AiImageRow = { src, alt, status: "checked", metadataSignals: [], provenAi: false, likelihood: null, kind: null, reasons: [], model: null, cached: false };
      const known = doneBySrc.get(src);
      if (known) {
        const r = readAiCheck(known);
        if (known.visionLikelihood === null) {
          rows[i] = { ...base, status: "skipped", bytes: known.bytes, kind: "icon", reason: `Icon-sized (under ${MIN_JUDGED_BYTES / 1024} KB): not sent to the AI model.`, cached: true };
          continue;
        }
        rows[i] = { ...base, bytes: known.bytes, metadataSignals: known.metadataSignals ?? [], provenAi: r.provenAi, likelihood: r.likelihood, kind: r.kind, reasons: r.reasons, model: known.visionModel ?? null, cached: true };
        continue;
      }
      try {
        const { res } = await fetchFollow(src, 20000);
        if (res.status >= 400) {
          rows[i] = { ...base, status: "failed", reason: `The picture answered ${res.status}.` };
          continue;
        }
        const contentType = res.headers.get("content-type") || "";
        if (!/^image\//i.test(contentType)) {
          rows[i] = { ...base, status: "skipped", reason: `Not a picture (${contentType || "unknown type"}).` };
          continue;
        }
        const buf = await readBytes(res, 10 * 1024 * 1024);
        if (buf.length < MIN_JUDGED_BYTES) {
          rows[i] = { ...base, status: "skipped", bytes: buf.length, kind: "icon", reason: `Icon-sized (under ${MIN_JUDGED_BYTES / 1024} KB): not sent to the AI model.` };
          // remembered, so the next run does not open it again
          await AiImageCheck.findOneAndUpdate(
            { sha256: createHash("sha256").update(buf).digest("hex") },
            { $set: { src, bytes: buf.length, contentType, metadataSignals: [], provenAi: false, visionVersion: VISION_VERSION, visionLikelihood: null, visionKind: "icon", visionReasons: [], visionModel: null, visionError: null, checkedAt: new Date() } },
            { upsert: true },
          );
          continue;
        }
        const sha256 = createHash("sha256").update(buf).digest("hex");
        const meta = metadataSignalsOf(buf);
        let stored: any = opts.force ? null : await AiImageCheck.findOne({ sha256 }).lean();
        const cached = Boolean(stored && (stored.visionVersion ?? 0) >= VISION_VERSION && stored.visionLikelihood !== null);
        if (!cached) {
          const v = await visionEstimate(buf, contentType);
          stored = await AiImageCheck.findOneAndUpdate(
            { sha256 },
            { $set: { src, bytes: buf.length, contentType, metadataSignals: meta.signals, provenAi: meta.provenAi, visionVersion: v.likelihood !== null ? VISION_VERSION : 0, visionLikelihood: v.likelihood, visionKind: v.kind, visionReasons: v.reasons, visionModel: v.model, visionError: v.error, checkedAt: new Date() } },
            { upsert: true, new: true, lean: true },
          );
        }
        rows[i] = {
          ...base,
          bytes: buf.length,
          metadataSignals: meta.signals,
          provenAi: meta.provenAi,
          likelihood: stored?.visionLikelihood ?? null,
          kind: stored?.visionKind ?? null,
          reasons: stored?.visionReasons ?? [],
          model: stored?.visionModel ?? null,
          reason: stored?.visionError || undefined,
          cached,
        };
      } catch (err: any) {
        rows[i] = { ...base, status: "failed", reason: err?.message || "The picture could not be read." };
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(3, batch.length) }, worker));

  const checked = rows.filter((r) => r.status === "checked");
  // icons, logos and screenshots are not pictures an AI image model would make for a page: they are left out of the percentage
  const outOfScope = (r: AiImageRow) => !r.provenAi && r.kind !== null && ["icon", "logo", "screenshot"].includes(r.kind);
  const judged = checked.filter((r) => !outOfScope(r) && (r.provenAi || r.likelihood !== null));
  const proven = checked.filter((r) => r.provenAi).length;
  const likely = judged.filter((r) => !r.provenAi && (r.likelihood ?? 0) >= AI_LIKELY).length;
  const average = judged.filter((r) => r.likelihood !== null).length
    ? Math.round(judged.filter((r) => r.likelihood !== null).reduce((s, r) => s + (r.likelihood as number), 0) / judged.filter((r) => r.likelihood !== null).length)
    : null;
  return {
    route: path,
    siteName: getSiteName(),
    auditedAt,
    totalPictures: candidates.length + skippedDecorative + skippedVector,
    skippedDecorative,
    skippedVector,
    notCheckedThisRun: Math.max(0, todo.length - Math.min(limit, todo.length)),
    /** Icons, logos and screenshots among the checked pictures (not counted in the percentage) */
    iconsAndLogos: checked.filter(outOfScope).length,
    checked: checked.length,
    judged: judged.length,
    provenAi: proven,
    likelyAi: likely,
    /** Pictures proven AI-made (metadata) or estimated at 70% or more, out of the pictures that could be judged */
    percentAi: judged.length ? Math.round(((proven + likely) / judged.length) * 100) : null,
    averageLikelihood: average,
    threshold: AI_LIKELY,
    rows,
  };
}
