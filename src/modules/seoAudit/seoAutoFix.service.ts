import Seo from "../../models/seo.model";
import { rebuildWebsite } from "../../utils/rebuildWebsite";
import { clearDeliveryCache } from "../seo/deliveryCache";
import { normalizeSchemaMarkup, schemaProblem } from "../../utils/schemaMarkup";

/** A fix or undo was saved: the website-facing endpoints answer fresh at once, and the static site is rebuilt (debounced) */
const siteChanged = (): void => {
  clearDeliveryCache();
  rebuildWebsite();
};
import { writeBlock, readBlock, ContentBlockError } from "./contentBlocksStore";
import { sitePageKeyForPath, readSitePageSeo, writeSitePageSeo, revertSitePageSeo, isSitePageField } from "./pageSeoStore";
import AdvancedSeo from "../../models/advancedSeo.model";
import Redirect from "../../models/Redirect.model";
import NotFoundHit from "../../models/NotFoundHit.model";
import SeoFixLog, { ISeoFixLog, toAuditLogView } from "../../models/seoFixLog.model";
import { SITE_PAGES } from "../sitePages/sitePages.registry";
import { logger } from "../../utils/logger";
import { env } from "../../config/env";
import { getSiteDescription, getSiteHost, getSiteName, getSiteOrigin } from "../../config/seoSite";
import type { CrawlResult } from "./crawler.service";
import SeoAuditSnapshot from "../../models/seoAudit.model";
import { TITLE_MIN, TITLE_MAX, DESC_MIN, DESC_MAX, imageAltKey, isGenericAlt } from "./seoPending.service";
import { isValidFromPath, isValidToTarget, normalizeFromPath, resolveChain, type RedirectRule } from "./redirectsExport";

/** Hard cap on pages touched by one batch run (each page can cost AI calls) */
export const MAX_AUTOFIX_PAGES = 100;

const escapeRegex = (v: string) => v.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
export const escapeHtml = (v: string) => v.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export class StaleRollbackError extends Error {
  status = 409;
  constructor(message: string) {
    super(message);
    this.name = "StaleRollbackError";
  }
}
export class NotFoundError extends Error {
  status = 404;
}

/** Normalize any path, route ID, or full URL to a clean pageKey for the Seo collection */
export function toPageKey(raw: string): string {
  let cleaned = (raw || "").trim().toLowerCase();
  try {
    if (cleaned.startsWith("http://") || cleaned.startsWith("https://")) {
      const u = new URL(cleaned);
      cleaned = u.pathname;
    }
  } catch {
    // leave as is
  }
  // Sanitize path traversal attempts (.. or multiple slashes)
  cleaned = cleaned.replace(/\.\.+/g, "").replace(/^\/+|\/+$/g, "");
  if (!cleaned || cleaned === "home" || cleaned === "index") {
    return "home";
  }
  return cleaned;
}

export function toCleanPath(raw: string): string {
  const key = toPageKey(raw);
  return key === "home" ? "/" : `/${key}`;
}

export function toAbsoluteUrl(raw: string): string {
  const path = toCleanPath(raw);
  const origin = getSiteOrigin();
  return `${origin}${path === "/" ? "" : path}`;
}

/** Validate redirect target against open redirect vulnerabilities (CWE-601). Same character rules as the export. */
export function isSafeRedirectTarget(target: string): boolean {
  if (!target || typeof target !== "string") return false;
  const trimmed = target.trim();
  if (/^(javascript|data|vbscript):/i.test(trimmed)) return false;
  if (!isValidToTarget(trimmed)) return false;
  if (trimmed.startsWith("/")) return true;
  try {
    const u = new URL(trimmed);
    const bare = (h: string) => h.toLowerCase().replace(/^www\./, "");
    return bare(u.hostname) === bare(getSiteHost());
  } catch {
    return false;
  }
}

/** Fallback helper: generate human readable page name from route */
function readablePageName(routeKey: string): string {
  if (routeKey === "home") return "Home";
  const def = SITE_PAGES.find((p) => p.key.toLowerCase() === routeKey.toLowerCase() || p.path === `/${routeKey}`);
  if (def?.title) return def.title;
  const lastPart = routeKey.split("/").pop() || routeKey;
  return lastPart.replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

/** True when an LLM key is configured */
export const aiAvailable = () => Boolean(env.GEMINI_API_KEY || env.OPENAI_API_KEY);

/** Calls Gemini or OpenAI (keys and model names come from the environment). Returns null when no provider answered. */
export async function generateAiSeoText(prompt: string, maxTokens = 200): Promise<string | null> {
  if (env.GEMINI_API_KEY) {
    try {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(env.GEMINI_MODEL)}:generateContent`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": env.GEMINI_API_KEY },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.3, maxOutputTokens: maxTokens },
        }),
        signal: AbortSignal.timeout(12000),
      });
      if (res.ok) {
        const data: any = await res.json();
        const text = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
        if (text) return text.replace(/^["'`]|["'`]$/g, "").trim();
      }
    } catch (err: any) {
      logger.warn(`[AI SEO] Gemini call failed: ${err.message}`);
    }
  }

  if (env.OPENAI_API_KEY) {
    try {
      const oaiBody: Record<string, unknown> = {
        model: env.OPENAI_MODEL,
        messages: [
          { role: "system", content: `You are an enterprise SEO director for ${getSiteName()}, a business that provides ${getSiteDescription()}.` },
          { role: "user", content: prompt },
        ],
        temperature: 0.3,
      };
      if (/^(o1|o3|gpt-5)/i.test(env.OPENAI_MODEL)) {
        oaiBody.max_completion_tokens = maxTokens;
      } else {
        oaiBody.max_tokens = maxTokens;
      }
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${env.OPENAI_API_KEY}` },
        body: JSON.stringify(oaiBody),
        signal: AbortSignal.timeout(12000),
      });
      if (res.ok) {
        const data: any = await res.json();
        const text = data?.choices?.[0]?.message?.content?.trim();
        if (text) return text.replace(/^["'`]|["'`]$/g, "").trim();
      } else {
        const errText = await res.text();
        logger.warn(`[AI SEO] OpenAI call failed with status ${res.status}: ${errText.slice(0, 200)}`);
      }
    } catch (err: any) {
      logger.warn(`[AI SEO] OpenAI call failed: ${err.message}`);
    }
  }

  return null;
}

/** Same providers as generateAiSeoText, but asks for a JSON object and returns it parsed (null when nothing usable came back). */
export async function generateAiJson(prompt: string, timeoutMs = 25000): Promise<any | null> {
  // 1. Try Gemini models
  if (env.GEMINI_API_KEY) {
    const geminiModels = [env.GEMINI_MODEL, "gemini-1.5-flash", "gemini-2.0-flash"].filter(Boolean);
    for (const model of Array.from(new Set(geminiModels))) {
      try {
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-goog-api-key": env.GEMINI_API_KEY },
          body: JSON.stringify({ contents: [{ role: "user", parts: [{ text: prompt }] }], generationConfig: { temperature: 0.3, responseMimeType: "application/json" } }),
          signal: AbortSignal.timeout(timeoutMs),
        });
        if (res.ok) {
          const data: any = await res.json();
          const raw = data?.candidates?.[0]?.content?.parts?.[0]?.text;
          if (raw) return JSON.parse(raw);
        }
      } catch (err: any) {
        logger.warn(`[AI JSON] Gemini ${model} failed: ${err.message}`);
      }
    }
  }

  // 2. Try OpenAI
  if (env.OPENAI_API_KEY) {
    const oaiModel = env.OPENAI_MODEL && env.OPENAI_MODEL !== "gpt-5.4-mini" ? env.OPENAI_MODEL : "gpt-4o-mini";
    try {
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${env.OPENAI_API_KEY}` },
        body: JSON.stringify({ model: oaiModel, messages: [{ role: "user", content: prompt }], temperature: 0.3, response_format: { type: "json_object" } }),
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (res.ok) {
        const data: any = await res.json();
        const raw = data?.choices?.[0]?.message?.content;
        if (raw) return JSON.parse(raw);
      }
    } catch (err: any) {
      logger.warn(`[AI JSON] OpenAI call failed: ${err.message}`);
    }
  }
  return null;
}

export interface AutoFixOptions {
  metaTitle?: string;
  metaDescription?: string;
  h1Heading?: string;
  h1ExtraTag?: "h2" | "h3" | "h4" | "p" | "div";
  canonicalUrl?: string;
  fromUrl?: string;
  toUrl?: string;
  statusCode?: number;
  imageSrc?: string;
  altText?: string;
  ogImage?: string;
  /** schema markup (JSON-LD) written by the admin: one block or several; used instead of the suggested one */
  schemaMarkup?: string;
}

export interface AutoFixResult {
  success: boolean;
  message: string;
  fixLog?: ISeoFixLog;
  fixLogs?: ISeoFixLog[];
  appliedFixes?: string[];
  /** What was NOT written and why, e.g. { title: "ai_unavailable" } */
  skipped?: Record<string, string>;
  seo?: unknown;
  /** Preview only (dryRun): what WOULD be written. Nothing was saved. */
  dryRun?: boolean;
  preview?: Array<{ type: string; before: unknown; after: unknown }>;
}

/** Crawl facts of one page that "auto" mode decides from */
export type CrawlFacts = Pick<CrawlResult, "requestedPath" | "httpStatus" | "ok" | "title" | "metaDescription" | "canonical" | "canonicalStatus" | "openGraph" | "jsonLdBlocks" | "h1">;

const CRAWL_SELECT = "crawls.requestedPath crawls.httpStatus crawls.ok crawls.title crawls.metaDescription crawls.canonical crawls.canonicalStatus crawls.openGraph crawls.jsonLdBlocks crawls.h1";

export async function loadCrawls(): Promise<CrawlFacts[]> {
  const snap: any = await SeoAuditSnapshot.findOne().sort({ createdAt: -1 }).select(CRAWL_SELECT).lean();
  return Array.isArray(snap?.crawls) ? snap.crawls : [];
}

/** Routes the site really has: "home", registry paths and crawled routes (never an arbitrary string) */
async function assertKnownRoute(pageKey: string, crawls: CrawlFacts[]) {
  if (pageKey === "home") return;
  if (!/^[a-z0-9][a-z0-9/_-]{0,200}$/.test(pageKey) || pageKey.includes("//") || pageKey.includes("..")) throw new Error("Invalid route.");
  if (SITE_PAGES.some((p) => p.path && toPageKey(p.path) === pageKey)) return;
  if (crawls.some((c) => toPageKey(c.requestedPath || "/") === pageKey)) return;
  if (await Seo.exists({ page: pageKey })) return;
  throw new Error(`Unknown route "${pageKey}": it is not a page of this site.`);
}

const lenOk = (v: string | null | undefined, min: number, max: number) => {
  const n = (v || "").trim().length;
  return n >= min && n <= max;
};

/** A readable alt text from an image file name ("hero-last-rites_01.webp" -> "Hero last rites"); null if the name says nothing */
export function altFromFilename(src: string): string | null {
  let name = "";
  try {
    name = decodeURIComponent(new URL(src, "https://x.invalid").pathname.split("/").pop() || "");
  } catch {
    name = src.split("/").pop() || "";
  }
  // Remove hash / build fingerprints like .dce59291.w2560.webp
  name = name.replace(/\.[a-f0-9]{6,12}(?=\.)/gi, "").replace(/\.w\d+/gi, "");
  const words = name
    .replace(/\.[a-z0-9]{2,5}$/i, "")
    .split(/[-_.\s]+/)
    .filter((w) => /^[a-z0-9]{2,}$/i.test(w) && !/^(img|image|photo|pic|picture|bg|background|thumb|thumbnail|copy|final|new|untitled|webp|jpeg|jpg|png|small|large|medium|w\d+)$/i.test(w));
  if (words.length === 0) return null;
  const t = words.join(" ");
  return t.charAt(0).toUpperCase() + t.slice(1);
}

/** Tracked Seo document fields (everything a fix can touch) */
const TRACKED = ["metaTitle", "ogTitle", "metaDescription", "ogDescription", "canonicalUrl", "canonicalTag", "ogImage", "ogImageAlt", "twitterCard", "twitterTitle", "twitterDescription", "twitterImage", "openGraphTags", "schemaMarkup", "robotsIndex", "robotsFollow", "h1Heading", "h1ExtraTag"] as const;
type Tracked = (typeof TRACKED)[number];
type Fields = Partial<Record<Tracked, string | boolean>>;

const pick = (src: Fields, keys: string[]): Fields => Object.fromEntries(keys.map((k) => [k, src[k as Tracked] ?? (k.startsWith("robots") ? true : "")])) as Fields;

/** Builds a Mongo filter asserting that fields still hold the values this fix wrote ("" matches empty or missing) */
function conditionFor(fields: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, v === "" || v === null || v === undefined ? { $in: ["", null] } : v]));
}

export const seoAutoFixService = {
  /**
   * Fix a single issue ("title", "description", ...) or, with issueType "all", only what the latest live crawl says is
   * wrong for this page. Nothing is ever invented: when no AI provider answers (or its answer is out of range) the
   * field is skipped (`skipped.<field> = "ai_unavailable"`) and nothing is written for it.
   */
  async autoFixPage(
    pageUrl: string,
    route: string,
    issueType: string = "all",
    options: AutoFixOptions = {},
    fixedBy: string = "AI Auto-Pilot",
    ctx: { crawls?: CrawlFacts[]; dryRun?: boolean } = {}
  ): Promise<AutoFixResult> {
    const pageKey = toPageKey(route || pageUrl);
    const cleanPath = toCleanPath(route || pageUrl);
    const absoluteUrl = toAbsoluteUrl(route || pageUrl);
    const pageTitle = readablePageName(pageKey);
    const brand = getSiteName();
    const crawls = ctx.crawls ?? (await loadCrawls());

    // 1. Redirect for a broken URL
    if (issueType === "redirect") {
      let fromUrl = (options.fromUrl || pageUrl || "").trim();
      const toUrlRaw = (options.toUrl || "").trim();
      if (!fromUrl) throw new Error("Source URL (fromUrl) is required for a redirect.");
      if (!toUrlRaw) throw new Error("Destination (toUrl) is required for a redirect.");
      const statusCode = options.statusCode || 301;
      try {
        if (/^https?:\/\//i.test(fromUrl)) fromUrl = new URL(fromUrl).pathname;
      } catch {
        throw new Error("Invalid source URL (fromUrl).");
      }
      fromUrl = normalizeFromPath(fromUrl);
      if (!isValidFromPath(fromUrl)) throw new Error("Invalid source URL: it must be a plain path (no wildcards, placeholders, query, spaces or backslashes).");
      if (!isSafeRedirectTarget(toUrlRaw)) throw new Error("Invalid redirect destination (toUrl). Open redirects to external or dangerous domains are blocked.");
      if (![301, 302, 307, 308].includes(statusCode)) throw new Error("statusCode must be 301, 302, 307 or 308.");

      const active = (await Redirect.find({ isActive: true }).select("fromUrl toUrl statusCode").lean()) as any[];
      const rules: RedirectRule[] = active.filter((r) => normalizeFromPath(r.fromUrl) !== fromUrl).map((r) => ({ from: r.fromUrl, to: r.toUrl, status: r.statusCode }));
      const chain = resolveChain(fromUrl, toUrlRaw, rules);
      if (chain.loop) throw new Error("Invalid redirect: it would create a redirect loop.");
      // point at the final destination so visitors never go through a chain
      const toUrl = chain.final;
      if (normalizeFromPath(toUrl) === fromUrl) throw new Error("A redirect cannot point to itself.");

      const existing = await Redirect.findOne({ fromUrl });
      const previousValue = existing ? { toUrl: existing.toUrl, statusCode: existing.statusCode, isActive: existing.isActive } : null;
      const log = await SeoFixLog.create({
        pageUrl: fromUrl, route: fromUrl, issueType: "redirect", previousValue, newValue: { fromUrl, toUrl, statusCode }, fixedBy, status: "failed", errorReason: "not completed",
        snapshot: { before: previousValue ?? {}, after: { fromUrl, toUrl, statusCode } },
      });
      try {
        await Redirect.findOneAndUpdate({ fromUrl }, { $set: { fromUrl, toUrl, statusCode, isActive: true } }, { upsert: true, returnDocument: "after", runValidators: true });
        await SeoFixLog.updateOne({ _id: log._id }, { $set: { status: "applied" }, $unset: { errorReason: 1 } });
      } catch (err: any) {
        await SeoFixLog.updateOne({ _id: log._id }, { $set: { status: "failed", errorReason: String(err?.message).slice(0, 300) } });
        throw err;
      }
      const fixLog = await SeoFixLog.findById(log._id);
      siteChanged();
      return { success: true, message: `Created ${statusCode} redirect from ${fromUrl} to ${toUrl}`, fixLog: fixLog ?? undefined };
    }

    // 2. Image alt text (per image: from the file name, or the AI, or skipped)
    if (issueType === "image_alt") {
      const imageSrc = options.imageSrc;
      if (!imageSrc || imageSrc.length > 2048) throw new Error("imageSrc is required to fix image alt attribute.");
      if (!/^(https?:\/\/|\/)[^\s\u0000-\u001f]*$/.test(imageSrc)) throw new Error("Invalid imageSrc: it must be an image URL or a path starting with /.");
      await assertKnownRoute(pageKey, crawls);

      const typedAlt = (options.altText || (options as any).alt)?.trim();
      let altText = typedAlt || altFromFilename(imageSrc);
      // A name taken from the file ("icon", "logo") says nothing about the picture: that is not a fix
      if (!typedAlt && altText && isGenericAlt(altText)) altText = null;
      if (!altText && aiAvailable()) {
        const ai = await generateAiSeoText(`Write a concise, literal alt text (max 12 words) for an image on the page "${pageTitle}" of ${brand}. The image file is named "${imageSrc.split("/").pop()?.slice(0, 120)}". Do not guess details you cannot know from the file name. Never answer with only "icon", "image", "logo" or "photo". Output ONLY the alt text.`, 40);
        if (ai && ai.length >= 4 && ai.length <= 125 && !isGenericAlt(ai)) altText = ai;
      }
      if (!altText) return { success: false, message: "No meaningful alt text could be derived for this image (its file name says nothing about the picture): type one yourself.", skipped: { image_alt: aiAvailable() ? "no_usable_text" : "ai_unavailable" } };
      altText = altText.slice(0, 125);

      const key = imageAltKey(imageSrc);
      const existingAdv: any = await AdvancedSeo.findOne().select(`imageAlts.${key}`).lean();
      const prevAlt = existingAdv?.imageAlts instanceof Map ? existingAdv.imageAlts.get(key) : existingAdv?.imageAlts?.[key] ?? null;

      if (ctx.dryRun) {
        return {
          success: true,
          dryRun: true,
          message: "Dry run preview",
          preview: [{ type: "image_alt", before: prevAlt || "(none)", after: altText }],
        };
      }

      const prevDoc: any = await AdvancedSeo.findOneAndUpdate({}, { $set: { [`imageAlts.${key}`]: altText } }, { upsert: true, returnDocument: "before" });
      const previousAlt = (prevDoc?.imageAlts instanceof Map ? prevDoc.imageAlts.get(key) : prevDoc?.imageAlts?.[key]) ?? prevAlt ?? null;
      const fixLog = await SeoFixLog.create({
        pageUrl: absoluteUrl, route: cleanPath, issueType: "image_alt",
        previousValue: { imageSrc, alt: previousAlt }, newValue: { imageSrc, alt: altText }, fixedBy, status: "applied",
        snapshot: { before: { imageSrc, alt: previousAlt }, after: { imageSrc, alt: altText } },
      });
      siteChanged();
      return { success: true, message: `Updated alt text for image "${imageSrc.slice(-30)}"`, fixLog };
    }

    // 3. Page SEO fields
    await assertKnownRoute(pageKey, crawls);
    const auto = issueType === "all";
    const crawl = crawls.find((c) => toPageKey(c.requestedPath || "/") === pageKey);
    if (auto && (!crawl || !crawl.ok || (crawl.httpStatus ?? 200) >= 400)) {
      return { success: true, message: `No healthy crawl data for ${cleanPath}: nothing changed`, appliedFixes: [], skipped: { page: "no_crawl" } };
    }

    const existingDoc: any = await Seo.findOne({ page: pageKey }).lean();
    // The website reads a page's SEO from its Pages & CMS record: that is where the fix must be read from and written to
    const sitePageKey = sitePageKeyForPath(cleanPath);
    const siteSeo: Record<string, any> | null = sitePageKey ? await readSitePageSeo(sitePageKey) : null;
    const cur: Fields = {};
    for (const k of TRACKED) {
      const from = siteSeo && isSitePageField(k) ? siteSeo : existingDoc;
      cur[k] = from?.[k] ?? (k.startsWith("robots") ? true : "");
    }
    const skipped: Record<string, string> = {};
    const alreadySaved: string[] = [];
    const changes: Array<{ type: string; before: Fields; after: Fields; prev: unknown; next: unknown }> = [];
    const apply = (type: string, patch: Fields, prev: unknown, next: unknown) => {
      const before = pick(cur, Object.keys(patch));
      Object.assign(cur, patch);
      changes.push({ type, before, after: { ...patch }, prev, next });
    };
    const str = (k: Tracked) => String(cur[k] ?? "");

    // TITLE
    if (issueType === "title" || (auto && !lenOk(crawl?.title, TITLE_MIN, TITLE_MAX) && !lenOk(str("metaTitle"), TITLE_MIN, TITLE_MAX))) {
      let t = options.metaTitle?.trim();
      // a good title is already saved in the website data and only the live page still shows the old one: no new text is needed
      const savedTitle = str("metaTitle").trim();
      const titleWaiting = !t && issueType === "title" && lenOk(savedTitle, TITLE_MIN, TITLE_MAX) && Boolean(crawl) && crawl!.title?.replace(/\s+/g, " ").trim().toLowerCase() !== savedTitle.replace(/\s+/g, " ").toLowerCase();
      if (titleWaiting) alreadySaved.push(`title \u201C${savedTitle}\u201D`);
      if (!t && !titleWaiting) {
        const ai = aiAvailable()
          ? await generateAiSeoText(`Write an optimized, compelling SEO title tag for the page "${pageTitle}" of ${brand} (${getSiteDescription()}). Strictly ${TITLE_MIN + 10} to ${TITLE_MAX - 5} characters including the brand name. Output ONLY the title text.`, 40)
          : null;
        if (ai && lenOk(ai, TITLE_MIN, TITLE_MAX)) t = ai;
        else {
          // Deterministic fallback if external AI provider is rate-limited or fails
          const existingTitle = crawl?.title?.trim() || str("metaTitle").trim();
          if (existingTitle && existingTitle.length > TITLE_MAX) {
            const cut = existingTitle.slice(0, TITLE_MAX - 3).replace(/[,;:\s]+[^\s]*$/, "").trim();
            if (lenOk(cut, TITLE_MIN, TITLE_MAX)) t = cut;
          }
          // never invent a title from a template: with no usable AI answer and nothing to trim, nothing is written
          if (!t) skipped.title = ai ? "ai_out_of_range" : "ai_unavailable";
        }
      }
      if (t && t === str("metaTitle").trim()) alreadySaved.push(`title \u201C${t}\u201D`);
      if (t && t !== str("metaTitle")) {
        const patch: Fields = { metaTitle: t };
        // the share title follows the page title when it was empty or was simply a copy of the old title; a share title written by a person is never overwritten
        if (!str("ogTitle").trim() || str("ogTitle").trim() === str("metaTitle").trim()) patch.ogTitle = t;
        apply("title", patch, str("metaTitle"), t);
      }
    }

    // DESCRIPTION
    if (issueType === "description" || (auto && !lenOk(crawl?.metaDescription, DESC_MIN, DESC_MAX) && !lenOk(str("metaDescription"), DESC_MIN, DESC_MAX))) {
      let d = options.metaDescription?.trim();
      const savedDesc = str("metaDescription").trim();
      const descWaiting = !d && issueType === "description" && lenOk(savedDesc, DESC_MIN, DESC_MAX) && Boolean(crawl) && (crawl!.metaDescription ?? "").replace(/\s+/g, " ").trim().toLowerCase() !== savedDesc.replace(/\s+/g, " ").toLowerCase();
      if (descWaiting) alreadySaved.push("description");
      if (!d && !descWaiting) {
        // The admin's own words come first: a description that exists but is too long is trimmed (their wording, cut at a
        // sentence or word end); one that is too short is extended by the AI from THEIR text. Only a page with no
        // description at all gets a new one written from scratch.
        const existingDesc = (str("metaDescription").trim() || crawl?.metaDescription?.trim() || "").replace(/\s+/g, " ");
        const noNewNumbers = (out: string) => (out.match(/\d+/g) || []).every((n) => existingDesc.includes(n));
        if (existingDesc.length > DESC_MAX) {
          // cut where the admin's own text ends a sentence or a clause, never in the middle of a phrase
          const room = existingDesc.slice(0, DESC_MAX - 4);
          const ends: number[] = [];
          for (const m of room.matchAll(/[.!?।](?=\s)/g)) ends.push(m.index! + 1);
          for (const m of room.matchAll(/(?:,|;|:|\s[—–-])(?=\s)/g)) ends.push(m.index!);
          for (const at of ends.sort((x, y) => y - x)) {
            const cut = room.slice(0, at).replace(/[\s,;:—–-]+$/, "").trim();
            const done = /[.!?।]$/.test(cut) ? cut : `${cut}.`;
            if (lenOk(done, DESC_MIN, DESC_MAX)) {
              d = done;
              break;
            }
          }
        }
        if (!d) {
          const prompt = existingDesc
            ? `Rewrite this meta description for the page "${pageTitle}" of ${brand} so it is between ${DESC_MIN + 10} and ${DESC_MAX - 10} characters. Keep the same meaning and as much of its wording as possible. Add NO new facts, numbers, names or promises. Output ONLY the description.\n\nDescription:\n"""${existingDesc}"""`
            : `Write an empathetic, high-CTR SEO meta description for the page "${pageTitle}" of ${brand} (${getSiteDescription()}). Strictly ${DESC_MIN + 10} to ${DESC_MAX - 10} characters, with a clear call to action. Output ONLY the description.`;
          // up to three tries; each retry tells the model exactly what was wrong with its last answer
          let ai: string | null = null;
          let note = "";
          for (let attempt = 0; attempt < 3 && aiAvailable(); attempt++) {
            const out = (await generateAiSeoText(prompt + note, 120))?.replace(/^["“]|["”]$/g, "").replace(/\s+/g, " ").trim() ?? null;
            if (!out) continue;
            ai = out;
            if (lenOk(out, DESC_MIN, DESC_MAX) && (!existingDesc || noNewNumbers(out))) {
              d = out;
              break;
            }
            note = `\n\nYour previous answer had ${out.length} characters${noNewNumbers(out) || !existingDesc ? "" : " and added numbers"}. It MUST be between ${DESC_MIN + 10} and ${DESC_MAX - 10} characters${existingDesc ? " and add no new numbers" : ""}. Try again.`;
          }
          // never invent a description from a template: with no usable AI answer and nothing to trim, nothing is written
          if (!d) skipped.description = ai ? "ai_out_of_range" : "ai_unavailable";
        }
      }
      if (d && d === str("metaDescription").trim()) alreadySaved.push("description");
      if (d && d !== str("metaDescription")) {
        const patch: Fields = { metaDescription: d };
        if (!str("ogDescription").trim() || str("ogDescription").trim() === str("metaDescription").trim()) patch.ogDescription = d;
        apply("description", patch, str("metaDescription"), d);
      }
    }

    // CANONICAL
    if (issueType === "canonical" || (auto && (crawl?.canonicalStatus !== "self" || !str("canonicalUrl").trim()))) {
      const url = options.canonicalUrl?.trim() || absoluteUrl;
      if (url === str("canonicalUrl").trim()) {
        alreadySaved.push("canonical");
      } else {
        apply("canonical", { canonicalUrl: url, canonicalTag: `<link rel="canonical" href="${escapeHtml(url)}" />` }, str("canonicalUrl"), url);
      }
    }

    // OPEN GRAPH: only empty fields are filled, existing values are never overwritten
    const ogIncomplete = !(crawl?.openGraph?.["og:title"] && crawl?.openGraph?.["og:description"] && crawl?.openGraph?.["og:image"]);
    if (issueType === "og" || (auto && ogIncomplete)) {
      const patch: Fields = {};
      const t = str("ogTitle").trim() || str("metaTitle").trim() || (crawl?.title ?? "").trim();
      const d = str("ogDescription").trim() || str("metaDescription").trim() || (crawl?.metaDescription ?? "").trim();
      const img = str("ogImage").trim() || options.ogImage?.trim() || env.SEO_DEFAULT_OG_IMAGE || "";
      if (!str("ogTitle").trim() && t) patch.ogTitle = t;
      if (!str("ogDescription").trim() && d) patch.ogDescription = d;
      if (!str("ogImage").trim() && img) patch.ogImage = img;
      if (Object.keys(patch).length === 0) {
        skipped.og = "no_source_value";
      } else {
        const f = { ogTitle: patch.ogTitle ?? str("ogTitle"), ogDescription: patch.ogDescription ?? str("ogDescription"), ogImage: patch.ogImage ?? str("ogImage") } as Record<string, string>;
        const e = (v: string) => escapeHtml(String(v));
        patch.openGraphTags = [
          `<meta property="og:title" content="${e(f.ogTitle)}" />`,
          `<meta property="og:description" content="${e(f.ogDescription)}" />`,
          f.ogImage ? `<meta property="og:image" content="${e(f.ogImage)}" />` : "",
          `<meta property="og:url" content="${e(absoluteUrl)}" />`,
          `<meta property="og:type" content="website" />`,
          `<meta name="twitter:card" content="summary_large_image" />`,
          `<meta name="twitter:title" content="${e(f.ogTitle)}" />`,
          `<meta name="twitter:description" content="${e(f.ogDescription)}" />`,
          f.ogImage ? `<meta name="twitter:image" content="${e(f.ogImage)}" />` : "",
        ].filter(Boolean).join("\n");
        apply("og", patch, { ogTitle: str("ogTitle"), ogDescription: str("ogDescription"), ogImage: str("ogImage") }, f);
      }
    }

    // SCHEMA: multi-schema JSON-LD graph (Organization, WebPage, Service / FuneralHome) tailored dynamically to page
    if (issueType === "schema" || (auto && (crawl?.jsonLdBlocks ?? 0) === 0 && !str("schemaMarkup").trim())) {
      const origin = getSiteOrigin();
      const description = str("metaDescription") || crawl?.metaDescription || getSiteDescription();
      const pageName = pageTitle.replace(/\s*[|–—-]\s*Moksha Voyage\s*$/i, "").trim() || pageTitle;

      const typedSchema = options.schemaMarkup?.trim();
      let graph: any[] = [];
      if (typedSchema) {
        // the admin's own schema (one block or several): checked, never replaced by a suggestion
        const problem = schemaProblem(typedSchema);
        if (problem) throw new Error(problem);
      } else if (pageKey === "home") {
        graph = [
          {
            "@type": "Organization",
            "@id": `${origin}/#organization`,
            name: brand,
            url: origin,
            description: getSiteDescription(),
          },
          {
            "@type": "WebSite",
            "@id": `${origin}/#website`,
            url: origin,
            name: brand,
            publisher: { "@id": `${origin}/#organization` },
          },
          {
            "@type": "FuneralHome",
            "@id": `${origin}/#localbusiness`,
            name: brand,
            url: origin,
            description: getSiteDescription(),
            priceRange: "₹₹",
          },
        ];
      } else {
        graph = [
          {
            "@type": "Organization",
            "@id": `${origin}/#organization`,
            name: brand,
            url: origin,
          },
          {
            "@type": "WebPage",
            "@id": `${absoluteUrl}/#webpage`,
            url: absoluteUrl,
            name: `${pageName} - ${brand}`,
            description,
            isPartOf: { "@id": `${origin}/#website` },
            breadcrumb: {
              "@type": "BreadcrumbList",
              itemListElement: [
                { "@type": "ListItem", position: 1, name: "Home", item: origin },
                { "@type": "ListItem", position: 2, name: pageName, item: absoluteUrl },
              ],
            },
          },
          {
            "@type": "Service",
            "@id": `${absoluteUrl}/#service`,
            name: `${pageName} - ${brand}`,
            serviceType: pageName,
            provider: { "@type": "Organization", name: brand, url: origin },
            url: absoluteUrl,
            description,
          },
        ];
      }

      const obj = {
        "@context": "https://schema.org",
        "@graph": graph,
      };
      const schema = typedSchema
        ? (normalizeSchemaMarkup(typedSchema) as string)
        : `<script type="application/ld+json">\n${JSON.stringify(obj, null, 2).replace(/</g, "\\u003c")}\n</script>`;
      apply("schema", { schemaMarkup: schema }, str("schemaMarkup"), schema);
    }

    // ROBOTS (explicit only: forcing index/follow could undo a deliberate noindex)
    if (issueType === "robots") {
      apply("robots", { robotsIndex: true, robotsFollow: true }, { robotsIndex: cur.robotsIndex, robotsFollow: cur.robotsFollow }, { robotsIndex: true, robotsFollow: true });
    }

    // H1 OVERRIDE (explicit or auto-fix when multiple H1s are detected)
    const h1Multiple = (crawl?.h1?.length ?? 0) > 1;
    // in auto mode a saved H1 is done: the site still shows several H1s until it is rebuilt, and the same fix must not be logged on every run
    if (issueType === "h1" || (auto && h1Multiple && !str("h1Heading").trim())) {
      const h = options.h1Heading?.trim() || crawl?.h1?.[0]?.trim() || pageTitle;
      if (!h) skipped.h1 = "h1_text_required";
      else apply("h1", { h1Heading: h.slice(0, 200), h1ExtraTag: options.h1ExtraTag || (str("h1ExtraTag") as AutoFixOptions["h1ExtraTag"]) || "h2" }, str("h1Heading"), h.slice(0, 200));
    }

    if (changes.length === 0 && alreadySaved.length > 0 && Object.keys(skipped).length === 0) {
      return {
        success: true,
        message: `Already saved: the ${alreadySaved.join(" and the ")} of ${cleanPath} ${alreadySaved.length > 1 ? "are" : "is"} already set in the website data. The live website shows ${alreadySaved.length > 1 ? "them" : "it"} after the next website build, so there is nothing more to fix here.`,
        appliedFixes: [],
        skipped,
      };
    }

    if (changes.length === 0) {
      const explicitFailed = !auto && Object.keys(skipped).length > 0;
      return {
        success: !explicitFailed,
        message: explicitFailed
          ? skipped.title === "ai_unavailable" || skipped.description === "ai_unavailable"
            ? "No AI provider is available, so nothing was written. Type the text yourself."
            : "Nothing was written: " + Object.entries(skipped).map(([k, v]) => `${k} (${v})`).join(", ")
          : `Nothing needed fixing on ${cleanPath}`,
        appliedFixes: [],
        skipped,
      };
    }

    // Preview: show what would be written and stop. Nothing is saved, no log, no website rebuild.
    if (ctx.dryRun) {
      return {
        success: true,
        dryRun: true,
        message: `Preview for ${cleanPath}: nothing was saved yet.`,
        preview: changes.map((c) => ({ type: c.type, before: c.prev, after: c.next })),
        appliedFixes: [],
        skipped,
      };
    }

    // pending logs first, then one atomic write, then flip the logs to applied (or failed)
    const logs = await SeoFixLog.insertMany(
      changes.map((c) => ({
        pageUrl: absoluteUrl, route: cleanPath, issueType: c.type, previousValue: c.prev, newValue: c.next, fixedBy, status: "failed", errorReason: "not completed",
        snapshot: { before: c.before, after: c.after },
      }))
    );
    const logIds = logs.map((l) => l._id);
    const merged: Record<string, unknown> = {};
    for (const c of changes) Object.assign(merged, c.after);
    // fields of a Pages & CMS page go to its record (what the website reads); the H1 override (and pages without a record) stay in the Seo collection
    const toSitePage: Record<string, unknown> = {};
    const toSeoDoc: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(merged)) (sitePageKey && isSitePageField(k) ? toSitePage : toSeoDoc)[k] = v;
    if (sitePageKey && merged.h1Heading) {
      toSitePage.h1Heading = merged.h1Heading;
    }
    const onInsert: Record<string, unknown> = { page: pageKey, isActive: true };
    if (!("robotsIndex" in toSeoDoc)) onInsert.robotsIndex = true;
    if (!("robotsFollow" in toSeoDoc)) onInsert.robotsFollow = true;
    try {
      if (sitePageKey && Object.keys(toSitePage).length) {
        await writeSitePageSeo(sitePageKey, toSitePage, fixedBy);
        // schema is cleaned on save: remember what was really stored, so the rollback compares with the right value
        const stored = await readSitePageSeo(sitePageKey);
        for (let i = 0; i < changes.length; i++) {
          const real: Record<string, unknown> = {};
          for (const k of Object.keys(changes[i].after)) if (isSitePageField(k)) real[k] = stored[k] ?? changes[i].after[k as Tracked];
          if (Object.keys(real).length) await SeoFixLog.updateOne({ _id: logIds[i] }, { $set: Object.fromEntries(Object.entries(real).map(([k, v]) => [`snapshot.after.${k}`, v])) });
        }
      }
      if (Object.keys(toSeoDoc).length) {
        await Seo.findOneAndUpdate({ page: pageKey }, { $set: { ...toSeoDoc, updatedBy: fixedBy }, $setOnInsert: onInsert }, { upsert: true, returnDocument: "after" });
      }
      await SeoFixLog.updateMany({ _id: { $in: logIds } }, { $set: { status: "applied" }, $unset: { errorReason: 1 } });
    } catch (err: any) {
      await SeoFixLog.updateMany({ _id: { $in: logIds } }, { $set: { status: "failed", errorReason: String(err?.message).slice(0, 300) } });
      throw err;
    }
    const applied = await SeoFixLog.find({ _id: { $in: logIds } }).sort({ createdAt: 1 });
    siteChanged();
    return {
      success: true,
      message: `Successfully applied ${changes.length} fix(es) on ${cleanPath}`,
      fixLogs: applied,
      appliedFixes: changes.map((c) => c.type),
      skipped,
    };
  },

  /**
   * Auto-fix every crawled page whose latest crawl shows a fixable problem. Runs inside a queue job (see
   * seoAuditQueue.service), never inside an HTTP request. Capped at MAX_AUTOFIX_PAGES.
   */
  async autoFixAllPages(
    _options: AutoFixOptions = {},
    fixedBy: string = "AI Auto-Pilot",
    maxPages: number = MAX_AUTOFIX_PAGES,
    onProgress?: (done: number, total: number) => void | Promise<void>
  ): Promise<{ success: boolean; totalPages: number; fixedCount: number; failedCount: number; skippedCount: number; truncated: boolean; logs: ISeoFixLog[] }> {
    const cap = Math.max(1, Math.min(MAX_AUTOFIX_PAGES, Math.floor(maxPages) || MAX_AUTOFIX_PAGES));
    const crawls = await loadCrawls();
    const keys = new Set<string>();
    for (const c of crawls) if (c.ok && (c.httpStatus ?? 200) < 400 && c.requestedPath) keys.add(toPageKey(c.requestedPath));
    const all = Array.from(keys);
    const routes = all.slice(0, cap);
    const allLogs: ISeoFixLog[] = [];
    let fixedCount = 0;
    let failedCount = 0;
    let skippedCount = 0;

    let done = 0;
    for (const route of routes) {
      try {
        const res = await this.autoFixPage(toAbsoluteUrl(route), route, "all", {}, fixedBy, { crawls });
        if (res.fixLogs && res.fixLogs.length > 0) {
          allLogs.push(...res.fixLogs);
          fixedCount++;
        } else if (res.skipped && Object.keys(res.skipped).length) skippedCount++;
      } catch (err: any) {
        logger.error(`[Auto-Fix All] Failed on route "${route}": ${err.message}`);
        failedCount++;
        await SeoFixLog.create({ pageUrl: toAbsoluteUrl(route), route: toCleanPath(route), issueType: "all", previousValue: null, newValue: null, fixedBy, status: "failed", errorReason: String(err?.message || err).slice(0, 500) }).catch(() => undefined);
      }
      done += 1;
      await onProgress?.(done, routes.length);
    }
    return { success: true, totalPages: routes.length, fixedCount, failedCount, skippedCount, truncated: all.length > routes.length, logs: allLogs };
  },

  /**
   * Roll back a fix. Uses the before/after snapshot stored in the log (every field the fix touched): the old values are
   * written back only if the fields still hold what the fix wrote (409 otherwise, unless `force`). A missing target is a
   * 404, never a silent success. The log is claimed atomically first, so two clicks cannot roll back twice.
   */
  async rollbackFix(fixLogId: string, revertedBy: string = "Admin User", force = false): Promise<{ success: boolean; message: string; log: ISeoFixLog }> {
    const log: any = await SeoFixLog.findById(fixLogId);
    if (!log) throw new NotFoundError(`SEO Fix Log not found for ID: ${fixLogId}`);
    if (log.reverted || log.status !== "applied") throw new Error(log.reverted ? "This fix has already been reverted." : "Only an applied fix can be rolled back.");

    const { issueType, pageUrl, route } = log;
    const pageKey = toPageKey(route || pageUrl);
    const snap = log.snapshot?.before && log.snapshot?.after ? log.snapshot : legacySnapshot(log);
    if (!snap) throw new Error(`Fixes of type "${issueType}" cannot be rolled back automatically.`);

    const claimed: any = await SeoFixLog.findOneAndUpdate(
      { _id: log._id, reverted: false, status: "applied" },
      { $set: { reverted: true, revertedAt: new Date(), revertedBy, status: "reverted" } },
      { returnDocument: "after" }
    );
    if (!claimed) throw new Error("This fix has already been reverted.");
    const release = () => SeoFixLog.updateOne({ _id: log._id }, { $set: { reverted: false, status: "applied" }, $unset: { revertedAt: 1, revertedBy: 1 } }).catch(() => undefined);

    try {
      const stale = (what: string) => new StaleRollbackError(`Cannot roll back: ${what} was changed after this fix. Roll back with force to overwrite the newer value.`);
      if (issueType === "redirect") {
        const fromUrl = String(snap.after.fromUrl || pageUrl);
        const cond = force ? { fromUrl } : { fromUrl, toUrl: snap.after.toUrl };
        const prev: any = snap.before;
        if (!(await Redirect.exists({ fromUrl }))) throw new NotFoundError(`The redirect from ${fromUrl} no longer exists.`);
        if (prev && prev.toUrl) {
          const r = await Redirect.updateOne(cond, { $set: { toUrl: prev.toUrl, statusCode: prev.statusCode ?? 301, isActive: prev.isActive ?? true } });
          if (r.matchedCount === 0) throw stale("the redirect");
        } else {
          const r = await Redirect.deleteOne(cond);
          if (r.deletedCount === 0) throw stale("the redirect");
        }
        // a redirect that came from the 404 log: the entry is open again
        await NotFoundHit.updateOne({ path: fromUrl, status: "redirected" }, { $set: { status: "open" }, $unset: { redirectId: 1, resolvedTo: 1, resolvedBy: 1 } });
      } else if (issueType === "copy_block") {
        // page text: put the old text back into the same CMS field, unless someone changed it since
        const blockId = String((snap.after as any).blockId);
        const beforeText = String((snap.before as any).text ?? "");
        const afterText = String((snap.after as any).text ?? "");
        try {
          await readBlock(route || pageUrl, blockId);
          await writeBlock(route || pageUrl, blockId, beforeText, force ? null : afterText, revertedBy);
        } catch (e) {
          if (e instanceof ContentBlockError) {
            if (e.status === 409) throw stale("the text");
            if (e.status === 404) throw new NotFoundError(e.message);
          }
          throw e;
        }
      } else if (issueType === "image_alt") {
        const key = imageAltKey(String(snap.after.imageSrc));
        const field = `imageAlts.${key}`;
        const cond: Record<string, unknown> = force ? {} : { [field]: snap.after.alt };
        const prevAlt = snap.before.alt;
        const r = await AdvancedSeo.updateOne(cond, prevAlt ? { $set: { [field]: prevAlt } } : { $unset: { [field]: 1 } });
        if (r.matchedCount === 0) throw stale("the image alt text");
      } else {
        const sitePageKey = sitePageKeyForPath(toCleanPath(route || pageUrl));
        const beforeSite: Record<string, unknown> = {};
        const afterSite: Record<string, unknown> = {};
        const beforeDoc: Record<string, unknown> = {};
        const afterDoc: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(snap.before as Record<string, unknown>)) (sitePageKey && isSitePageField(k) ? beforeSite : beforeDoc)[k] = v;
        for (const [k, v] of Object.entries(snap.after as Record<string, unknown>)) (sitePageKey && isSitePageField(k) ? afterSite : afterDoc)[k] = v;
        if (sitePageKey && Object.keys(beforeSite).length) {
          const outcome = await revertSitePageSeo(sitePageKey, beforeSite, afterSite, force, revertedBy);
          if (outcome === "missing") throw new NotFoundError(`The SEO record for ${route} no longer exists.`);
          if (outcome === "stale") throw stale(issueType);
        }
        if (Object.keys(beforeDoc).length) {
          if (!(await Seo.exists({ page: pageKey }))) throw new NotFoundError(`The SEO record for ${route} no longer exists.`);
          const r = await Seo.updateOne(force ? { page: pageKey } : { page: pageKey, ...conditionFor(afterDoc as any) }, { $set: { ...beforeDoc, updatedBy: revertedBy } });
          if (r.matchedCount === 0) throw stale(issueType);
        }
      }
    } catch (err) {
      await release();
      throw err;
    }
    siteChanged();
    return { success: true, message: `Successfully rolled back fix "${issueType}" for ${route}`, log: claimed };
  },

  /**
   * List fix logs with pagination. `status` / `fixedBy` in each row use the audit-log vocabulary
   * (SUCCESS | FAILED | REVERTED, AUTO_PILOT_AI | ADMIN); the stored values are kept as storedStatus / fixedByUser.
   */
  async getFixLogs(params: { page?: number; limit?: number; route?: string; issueType?: string; reverted?: boolean }) {
    const page = Math.max(1, Math.floor(params.page || 1));
    const limit = Math.min(100, Math.max(1, Math.floor(params.limit || 30)));
    const filter: any = {};
    if (params.route) filter.route = new RegExp(escapeRegex(String(params.route).slice(0, 200)), "i");
    if (params.issueType) filter.issueType = String(params.issueType);
    if (params.reverted !== undefined) filter.reverted = params.reverted;

    const [logs, total] = await Promise.all([
      SeoFixLog.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
      SeoFixLog.countDocuments(filter),
    ]);
    return { logs: (logs as any[]).map((l) => toAuditLogView(l)), pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  },
};

/** Snapshot for logs written before snapshots existed (only the fields those fixes recorded) */
function legacySnapshot(log: any): { before: Fields; after: Fields } | null {
  const p = log.previousValue;
  const n = log.newValue;
  switch (log.issueType) {
    case "title": return { before: { metaTitle: p || "" }, after: { metaTitle: n || "" } };
    case "description": return { before: { metaDescription: p || "" }, after: { metaDescription: n || "" } };
    case "canonical": return { before: { canonicalUrl: p || "", canonicalTag: p ? `<link rel="canonical" href="${escapeHtml(p)}" />` : "" }, after: { canonicalUrl: n || "" } };
    case "og": return p ? { before: { ogTitle: p.ogTitle || "", ogDescription: p.ogDescription || "", ogImage: p.ogImage || "" }, after: { ogTitle: n?.ogTitle || "", ogDescription: n?.ogDescription || "", ogImage: n?.ogImage || "" } } : null;
    case "schema": return { before: { schemaMarkup: p || "" }, after: { schemaMarkup: n || "" } };
    case "robots": return p ? { before: { robotsIndex: p.robotsIndex ?? true, robotsFollow: p.robotsFollow ?? true }, after: { robotsIndex: n?.robotsIndex ?? true, robotsFollow: n?.robotsFollow ?? true } } : null;
    case "h1": return { before: { h1Heading: p || "" }, after: { h1Heading: n || "" } };
    case "humanize_copy": return p ? { before: { metaTitle: p.metaTitle || "", metaDescription: p.metaDescription || "", h1Heading: p.h1Heading || "" }, after: { metaTitle: n?.metaTitle || "", metaDescription: n?.metaDescription || "", h1Heading: n?.h1Heading || "" } } : null;
    case "redirect": return { before: p ?? {}, after: { fromUrl: n?.fromUrl || log.pageUrl, toUrl: n?.toUrl } } as any;
    case "image_alt": return { before: { imageSrc: n?.imageSrc, alt: p?.alt ?? null }, after: { imageSrc: n?.imageSrc, alt: n?.alt } } as any;
    default: return null;
  }
}
