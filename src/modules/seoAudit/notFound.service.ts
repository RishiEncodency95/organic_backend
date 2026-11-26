/**
 * 404 referral log. The website (or an edge function) reports a missing path and where the visitor came from; the
 * best matching LIVE page is found by comparing the words of the missing path with the live pages, and a redirect
 * is created in the Redirect collection (served to the static site through the public redirects endpoint / the
 * Netlify _redirects export).
 */
import NotFoundHit from "../../models/NotFoundHit.model";
import Redirect from "../../models/Redirect.model";
import SeoAuditSnapshot from "../../models/seoAudit.model";
import { getSiteHost, getSiteOrigin } from "../../config/seoSite";
import { seoAutoFixService } from "./seoAutoFix.service";
import { isValidFromPath, normalizeFromPath } from "./redirectsExport";
import type { CrawlResult } from "./crawler.service";

const MAX_TRACKED = 5000;
const MAX_REFERRERS = 15;
/** Used by the admin-triggered matcher only: below this similarity no redirect is created */
export const AUTO_MIN_CONFIDENCE = 0.6;

export function normalizeMissingPath(raw: string): string | null {
  let p = (raw || "").trim();
  try {
    if (/^https?:\/\//i.test(p)) {
      const u = new URL(p);
      if (u.hostname.replace(/^www\./, "") !== getSiteHost().replace(/^www\./, "")) return null;
      p = u.pathname;
    }
  } catch {
    return null;
  }
  // the query / hash is dropped; what remains must be a plain path (no wildcard, placeholder, backslash, control char ...)
  p = normalizeFromPath(p);
  if (p === "/" || !isValidFromPath(p)) return null;
  // static assets and well-known bot probes are noise, not pages
  if (/\.(png|jpe?g|gif|webp|svg|ico|css|js|map|woff2?|ttf|txt|xml|json|php|asp|env)$/i.test(p)) return null;
  return p;
}

// ---- proof that the origin really answers 404/410 for a path (a client report alone is never trusted) ----
const verifyCache = new Map<string, { at: number; missing: boolean }>();
let budgetWindow = 0;
let budgetCount = 0;
const VERIFY_TTL_MS = 10 * 60 * 1000;
const VERIFY_PER_MINUTE = 30;

async function originAnswersMissing(path: string): Promise<boolean> {
  const hit = verifyCache.get(path);
  if (hit && Date.now() - hit.at < VERIFY_TTL_MS) return hit.missing;
  const now = Date.now();
  if (now - budgetWindow > 60_000) {
    budgetWindow = now;
    budgetCount = 0;
  }
  if (++budgetCount > VERIFY_PER_MINUTE) return false; // fail closed
  let missing = false;
  try {
    const origin = getSiteOrigin();
    const url = new URL(path, origin);
    if (url.origin !== new URL(origin).origin) return false;
    const res = await fetch(url, { method: "HEAD", redirect: "manual", signal: AbortSignal.timeout(4000) });
    missing = res.status === 404 || res.status === 410;
  } catch {
    missing = false;
  }
  if (verifyCache.size > 2000) verifyCache.clear();
  verifyCache.set(path, { at: Date.now(), missing });
  return missing;
}

function cleanReferrer(raw: string): string {
  if (!raw) return "";
  try {
    const u = new URL(raw);
    if (u.protocol !== "http:" && u.protocol !== "https:") return "";
    return `${u.protocol}//${u.host}${u.pathname}`.slice(0, 512);
  } catch {
    return "";
  }
}

/** Words of a path, with a plural "s" dropped so /service and /services match */
const words = (p: string) => (p.toLowerCase().match(/[a-z0-9]+/g) || []).filter((w) => w.length > 1).map((w) => (w.length > 3 ? w.replace(/s$/, "") : w));

/** Similarity of two paths: share of words in common, boosted when one slug contains the other */
export function pathSimilarity(a: string, b: string): number {
  const wa = new Set(words(a));
  const wb = new Set(words(b));
  if (!wa.size || !wb.size) return 0;
  let common = 0;
  wa.forEach((w) => {
    if (wb.has(w)) common += 1;
  });
  const jaccard = common / (wa.size + wb.size - common);
  const last = (p: string) => p.split("/").filter(Boolean).pop() || "";
  const la = last(a);
  const lb = last(b);
  const contained = la.length > 3 && lb.length > 3 && (la.includes(lb) || lb.includes(la)) ? 0.25 : 0;
  return Math.min(1, jaccard + contained);
}

/** Live (HTTP 200, indexable) page paths from the latest crawl */
export async function livePagePaths(): Promise<string[]> {
  const snap: any = await SeoAuditSnapshot.findOne().sort({ createdAt: -1 }).select("crawls.requestedPath crawls.httpStatus crawls.ok crawls.indexable").lean();
  const out = new Set<string>();
  for (const c of ((snap?.crawls as CrawlResult[]) || [])) {
    if (c.ok && (c.httpStatus ?? 200) < 400 && c.indexable !== false) out.add((c.requestedPath || "/").replace(/\/+$/, "") || "/");
  }
  return Array.from(out);
}

export function bestMatch(missing: string, live: string[]): { path: string; confidence: number } | null {
  let best: { path: string; confidence: number } | null = null;
  for (const l of live) {
    if (l === "/" || l === missing) continue;
    const c = pathSimilarity(missing, l);
    if (c > (best?.confidence ?? 0)) best = { path: l, confidence: Math.round(c * 100) / 100 };
  }
  return best;
}

export const notFoundService = {
  /** Records one 404 hit. Returns whether it was stored (a path that is a live page, or junk, is ignored). */
  async record(rawPath: string, rawReferrer: string) {
    const path = normalizeMissingPath(rawPath);
    if (!path) return { recorded: false as const, reason: "invalid_path" };
    const live = await livePagePaths();
    if (live.includes(path)) return { recorded: false as const, reason: "path_is_live" };
    if (!(await originAnswersMissing(path))) return { recorded: false as const, reason: "origin_does_not_return_404" };

    const existing = await NotFoundHit.findOne({ path }).select("_id").lean();
    if (!existing && (await NotFoundHit.estimatedDocumentCount()) >= MAX_TRACKED) return { recorded: false as const, reason: "log_full" };

    const referrer = cleanReferrer(rawReferrer);
    const doc = await NotFoundHit.findOneAndUpdate(
      { path },
      { $inc: { hits: 1 }, $set: { lastSeenAt: new Date() }, $setOnInsert: { firstSeenAt: new Date(), status: "open" } },
      { upsert: true, returnDocument: "after" }
    );
    if (referrer) {
      const hit = (doc.referrers || []).find((r: any) => r.referrer === referrer);
      if (hit) {
        await NotFoundHit.updateOne({ path, "referrers.referrer": referrer }, { $inc: { "referrers.$.count": 1 }, $set: { "referrers.$.lastSeenAt": new Date() } });
      } else if ((doc.referrers || []).length < MAX_REFERRERS) {
        await NotFoundHit.updateOne({ path }, { $push: { referrers: { referrer, count: 1, lastSeenAt: new Date() } } });
      }
    }
    // A public report NEVER creates a redirect: only an admin-triggered run (autoRedirectOpen) may.
    return { recorded: true as const };
  },

  /** Creates the redirect for one logged path when a live page matches well enough. */
  async autoRedirectOne(path: string, by: string, minConfidence = AUTO_MIN_CONFIDENCE) {
    const live = await livePagePaths();
    const match = bestMatch(path, live);
    if (!match || match.confidence < minConfidence) return { created: false as const, match };
    if (await Redirect.exists({ fromUrl: path })) return { created: false as const, match, reason: "redirect_exists" };
    // same path as every other redirect: validated, loop-checked and logged with a rollback snapshot
    const res = await seoAutoFixService.autoFixPage(path, path, "redirect", { fromUrl: path, toUrl: match.path, statusCode: 301 }, by);
    const redirect = await Redirect.findOne({ fromUrl: path }).select("_id").lean();
    await NotFoundHit.updateOne({ path }, { $set: { status: "redirected", redirectId: (redirect as any)?._id, resolvedTo: match.path, resolvedBy: by } });
    return { created: true as const, match, redirectId: String((redirect as any)?._id ?? ""), logId: String((res.fixLog as any)?._id ?? "") };
  },

  /** Runs the matcher over every open entry that was seen at least `minHits` times. */
  async autoRedirectOpen(by: string, minHits = 1) {
    const open = await NotFoundHit.find({ status: "open", hits: { $gte: minHits } }).sort({ hits: -1 }).limit(200).lean();
    let created = 0;
    const unmatched: string[] = [];
    for (const h of open as any[]) {
      try {
        const r = await this.autoRedirectOne(h.path, by);
        if (r.created) created += 1;
        else unmatched.push(h.path);
      } catch {
        unmatched.push(h.path);
      }
    }
    return { examined: open.length, created, unmatched };
  },

  async list(status?: string) {
    const filter: any = status && ["open", "redirected", "ignored"].includes(status) ? { status } : {};
    const rows = await NotFoundHit.find(filter).sort({ hits: -1 }).limit(300).lean();
    const live = await livePagePaths();
    return (rows as any[]).map((r) => ({ ...r, suggestion: r.status === "open" ? bestMatch(r.path, live) : null }));
  },

  async ignore(id: string) {
    return NotFoundHit.findByIdAndUpdate(id, { $set: { status: "ignored" } }, { returnDocument: "after" });
  },
};
