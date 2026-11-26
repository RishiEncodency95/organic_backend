/**
 * Internal-linking mesh: finds pages whose real text is similar (TF-IDF + cosine) and suggests a link between them.
 * The text comes only from the latest live crawl of the website (title, description, headings, the visible page text).
 * "Applied" suggestions live in MongoDB and are served to the static website by the public overrides endpoint.
 */
import { clearDeliveryCache } from "../seo/deliveryCache";
import SeoAuditSnapshot from "../../models/seoAudit.model";
import Seo from "../../models/seo.model";
import { SitePage } from "../../models/sitePages/SitePage.model";
import { Home2Page } from "../../models/home2/Home2Page.model";
import { HOME2_PAGE_KEY, defaultHome2Sections } from "../home2/home2.defaults";
import { SERVICE_PAGE_CONTENT } from "../sitePages/definitions/servicePages.content";
import { BLOG_DETAIL_SEEDS } from "../sitePages/definitions/blogDetail";
import InternalLinkSuggestion, { IContextSnippet } from "../../models/InternalLinkSuggestion.model";
import { SITE_PAGES } from "../sitePages/sitePages.registry";
import type { CrawlResult } from "./crawler.service";
import { pageKeyOf } from "./seoPending.service";
import { embedTexts } from "./embeddings.service";

const STOP = new Set([
  // Core English Stop Words
  "a", "about", "above", "after", "again", "against", "all", "also", "am", "an", "and", "any", "are", "aren't", "as", "at",
  "be", "because", "been", "before", "being", "below", "between", "both", "but", "by",
  "can", "cannot", "could", "couldn't", "did", "didn't", "do", "does", "doesn't", "doing", "don't", "down", "during",
  "each", "few", "for", "from", "further", "had", "hadn't", "has", "hasn't", "have", "haven't", "having", "he", "her",
  "here", "hers", "herself", "him", "himself", "his", "how", "i", "if", "in", "into", "is", "isn't", "it", "its", "itself",
  "let's", "me", "more", "most", "mustn't", "my", "myself", "no", "nor", "not", "of", "off", "on", "once", "only", "or",
  "other", "ought", "our", "ours", "ourselves", "out", "over", "own", "same", "shan't", "she", "should", "shouldn't", "so",
  "some", "such", "than", "that", "the", "their", "theirs", "them", "themselves", "then", "there", "these", "they", "this",
  "those", "through", "to", "too", "under", "until", "up", "very", "was", "wasn't", "we", "were", "weren't", "what", "when",
  "where", "which", "while", "who", "whom", "why", "will", "with", "won't", "would", "wouldn't", "you", "your", "yours",
  "yourself", "yourselves", "us",
  // Boilerplate web noise words to preserve substantive funeral/service terms
  "page", "website", "click", "view", "read", "rights", "reserved", "copyright", "privacy", "terms", "conditions",
  "policy", "navigation", "menu", "footer", "header", "button", "form", "submit", "name", "email", "phone", "contact",
  "message", "call", "helpline", "available", "hours", "please", "thank", "thanks", "welcome", "home", "select", "option",
  "enter", "input", "true", "false", "null", "undefined", "http", "https", "www", "com", "org", "net", "icon", "image",
  "photo", "logo", "alt", "step", "steps", "list", "item", "items", "section", "sections", "card", "cards",
  "moksha", "voyage"
]);

export function tokenize(text: string): string[] {
  return (text.toLowerCase().match(/[a-zऀ-ॿ]{3,}/g) || []).filter((t) => !STOP.has(t));
}

export interface LinkDoc {
  path: string;
  title: string;
  text: string;
  /** The visible words of the page as the website shows them (crawl body text), when known */
  body?: string;
  excerpt: string;
  linksTo: Set<string>;
}

export interface LinkSuggestionResult {
  fromPath: string;
  toPath: string;
  anchorText: string;
  /** true when anchorText really appears in the words of the page that gets the link, so the link has a place to go */
  anchorPlaced: boolean;
  /** The sentence of the page that will carry the link */
  anchorContext: string;
  similarity: number;
  sharedTerms: string[];
  fromTitle: string;
  toTitle: string;
  fromExcerpt: string;
  toExcerpt: string;
  contextSnippets: IContextSnippet[];
}

/** Clean up text by removing extra spaces and non-printable characters */
export function cleanExcerpt(text: string, maxLen = 320): string {
  const cleaned = text
    .replace(/\s+/g, " ")
    .replace(/^[\s\W]+/, "")
    .trim();
  if (cleaned.length <= maxLen) return cleaned;
  const cut = cleaned.slice(0, maxLen);
  const lastSpace = cut.lastIndexOf(" ");
  return (lastSpace > 100 ? cut.slice(0, lastSpace) : cut) + "…";
}

/** Extract a surrounding context window / sentence around a matching term */
export function extractContextSentence(text: string, term: string): string {
  if (!text || !term) return "";
  const lower = text.toLowerCase();
  const idx = lower.indexOf(term.toLowerCase());
  if (idx === -1) return "";

  const start = Math.max(0, idx - 45);
  const end = Math.min(text.length, idx + term.length + 55);
  let snippet = text.slice(start, end).replace(/\s+/g, " ").trim();
  if (start > 0) snippet = "…" + snippet;
  if (end < text.length) snippet = snippet + "…";
  return snippet;
}

/** Flatten every string inside a CMS section object up to 35,000 characters */
function flattenStrings(value: unknown, out: string[], depth = 0) {
  if (depth > 10 || out.join(" ").length > 35000) return;
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (
      trimmed.length > 2 &&
      !/^(https?:|\/|#|fi-|[a-z0-9_-]+\.(png|jpe?g|webp|svg|gif|ico))/i.test(trimmed) &&
      !/^#[0-9a-f]{3,8}$/i.test(trimmed)
    ) {
      out.push(trimmed);
    }
  } else if (Array.isArray(value)) {
    value.forEach((v) => flattenStrings(v, out, depth + 1));
  } else if (value && typeof value === "object") {
    Object.values(value as object).forEach((v) => flattenStrings(v, out, depth + 1));
  }
}

/**
 * The pages as the website really shows them: the latest live crawl only (title, description, headings and the visible
 * page text). Text that lives only in seed files or the CMS defaults, but is not on the website, is never used.
 */
export async function buildCorpus(): Promise<LinkDoc[]> {
  const docs = new Map<string, LinkDoc>();
  const snap: any = await SeoAuditSnapshot.findOne().sort({ createdAt: -1 }).select("crawls").lean();
  for (const c of ((snap?.crawls as CrawlResult[]) || [])) {
    if (!c.ok || (c.httpStatus ?? 200) >= 400 || c.indexable === false) continue;
    const path = (c.requestedPath || "/").replace(/\/+$/, "") || "/";
    const d: LinkDoc = docs.get(path) ?? { path, title: "", text: "", excerpt: "", linksTo: new Set() };
    docs.set(path, d);
    d.title = c.title || d.title;
    if (c.metaDescription && !d.excerpt) d.excerpt = c.metaDescription;
    d.body = `${d.body ?? ""} ${c.linkableText || ""}`.trim();
    d.text += ` ${c.title || ""} ${c.metaDescription || ""} ${(c.h1 || []).join(" ")} ${(c.h2 || []).join(" ")} ${(c.h3 || []).join(" ")} ${c.bodyText || ""}`;
    for (const t of c.internalLinkTargets || []) {
      try {
        d.linksTo.add(new URL(t, "https://x.invalid").pathname.replace(/\/+$/, "") || "/");
      } catch {
        /* skip */
      }
    }
  }
  for (const d of docs.values()) if (!d.excerpt) d.excerpt = cleanExcerpt(d.text, 280);
  return Array.from(docs.values()).filter((d) => tokenize(d.text).length >= 8);
}

/** TF-IDF vectors + cosine similarity between every pair; pure function (testable). */
/**
 * Whole-content match of every pair of pages from their embeddings (unit-length vectors): the cosine between what the two
 * pages mean as a whole, 0..1 and shown as it is (82% = 0.82). Nothing is stretched or rescaled. A page against itself is 0 (never suggested).
 */
export function contentMatchMatrix(vectors: number[][]): number[][] {
  const cos = (a: number[], b: number[]) => a.reduce((s, x, k) => s + x * b[k], 0);
  return vectors.map((a, i) => vectors.map((b, j) => (i === j ? 0 : Math.max(0, Math.min(0.99, cos(a, b))))));
}

export function suggestLinks(docs: LinkDoc[], opts: { perPage?: number; minSimilarity?: number; vectors?: number[][] | null } = {}): LinkSuggestionResult[] {
  const perPage = opts.perPage ?? 3;
  const semantic = opts.vectors && opts.vectors.length === docs.length ? contentMatchMatrix(opts.vectors) : null;
  // whole-content match: ≥35% is a real relationship; the word-based fallback keeps its older 25% floor
  const min = opts.minSimilarity ?? (semantic ? 0.35 : 0.25);
  const tokens = docs.map((d) => tokenize(d.text));
  const df = new Map<string, number>();
  tokens.forEach((ts) => new Set(ts).forEach((t) => df.set(t, (df.get(t) || 0) + 1)));
  const N = docs.length;
  const vecs = tokens.map((ts) => {
    const tf = new Map<string, number>();
    ts.forEach((t) => tf.set(t, (tf.get(t) || 0) + 1));
    const v = new Map<string, number>();
    let norm = 0;
    tf.forEach((c, t) => {
      const w = (1 + Math.log(c)) * Math.log(1 + N / (df.get(t) || 1));
      v.set(t, w);
      norm += w * w;
    });
    return { v, norm: Math.sqrt(norm) || 1 };
  });

  const out: LinkSuggestionResult[] = [];
  for (let i = 0; i < N; i++) {
    const fromDoc = docs[i];
    const scored: Array<{ j: number; sim: number; shared: string[] }> = [];
    for (let j = 0; j < N; j++) {
      if (i === j || fromDoc.linksTo.has(docs[j].path) || docs[j].path === "/") continue;
      let dot = 0;
      const shared: Array<[string, number]> = [];
      vecs[i].v.forEach((w, t) => {
        const w2 = vecs[j].v.get(t);
        if (w2) {
          dot += w * w2;
          shared.push([t, w * w2]);
        }
      });
      // the percent comes from the WHOLE content when embeddings exist; the shared words below are only shown as examples
      const sim = semantic ? semantic[i][j] : dot / (vecs[i].norm * vecs[j].norm);
      if (sim >= min) {
        scored.push({
          j,
          sim,
          shared: shared
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(([t]) => t),
        });
      }
    }
    scored.sort((a, b) => b.sim - a.sim);
    for (const s of scored.slice(0, perPage)) {
      const target = docs[s.j];
      const rawAnchor = target.title.split(/\s[|–—-]\s/)[0] || target.path.replace(/^\/services\//, "").replace(/^\//, "").replace(/-/g, " ");
      const titleAnchor = rawAnchor.trim().slice(0, 100);
      const placed = fromDoc.body ? placeableAnchor(fromDoc.body, titleAnchor, (w) => (df.get(w.toLowerCase()) || 0) / N <= 0.15) : null;
      const anchor = (placed?.anchor ?? titleAnchor).slice(0, 100);

      const contextSnippets: IContextSnippet[] = s.shared.slice(0, 4).map((term) => ({
        term,
        fromSentence: extractContextSentence(fromDoc.text, term),
        toSentence: extractContextSentence(target.text, term),
      }));

      out.push({
        fromPath: fromDoc.path,
        toPath: target.path,
        anchorText: anchor,
        anchorPlaced: placed !== null,
        anchorContext: placed?.sentence ?? "",
        similarity: Math.round(s.sim * 1000) / 1000,
        sharedTerms: s.shared,
        fromTitle: fromDoc.title || fromDoc.path,
        toTitle: target.title || target.path,
        fromExcerpt: fromDoc.excerpt || cleanExcerpt(fromDoc.text, 280),
        toExcerpt: target.excerpt || cleanExcerpt(target.text, 280),
        contextSnippets,
      });
    }
  }
  return out;
}

const GENERIC_WORDS = new Set(["service", "services", "sewa", "support", "assistance", "complete", "moksha", "voyage", "about", "ritual", "rituals", "before", "after", "ahead", "consider", "family", "families", "travel", "planning", "international", "arrangement", "arrangements"]);
const bareWord = (w: string) => w.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, "");

/**
 * The words of the page that can carry the link, and the sentence they sit in. `text` is what a visitor reads on the page
 * outside headings, buttons, menus and existing links, so the link has a real place there. The whole title of the target
 * comes first, then its longest run of two or more words, then one distinctive word (not "service", "support" ...).
 * The words are returned exactly as the page writes them. Null when the page has nothing to hold this link.
 */
export function placeableAnchor(text: string, anchor: string, isDistinct: (word: string) => boolean = () => true): { anchor: string; sentence: string } | null {
  const esc = (x: string) => x.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const words = anchor.split(/\s+/).map(bareWord).filter((w) => w && w !== "&");
  const word = (w: string) => /^[\p{L}\p{N}-]{4,}$/u.test(w);
  const solid = (w: string) => word(w) && !GENERIC_WORDS.has(w.toLowerCase());
  const nameStart = (w: string) => word(w) && !/^(service|services|about|complete|moksha|voyage|our|your|the)$/i.test(w);
  const tryPhrase = (phrase: string) => {
    const m = new RegExp(`(?<![\\p{L}\\p{N}])${esc(phrase)}(?![\\p{L}\\p{N}])`, "iu").exec(text);
    if (!m) return null;
    const start = Math.max(text.lastIndexOf("\n", m.index), text.lastIndexOf(". ", m.index), text.lastIndexOf("? ", m.index), text.lastIndexOf("! ", m.index));
    const ends = [text.indexOf("\n", m.index), text.indexOf(". ", m.index), text.indexOf("? ", m.index), text.indexOf("! ", m.index)].filter((i) => i >= 0);
    const end = ends.length ? Math.min(...ends) + 1 : text.length;
    const sentence = text.slice(start < 0 ? 0 : start + 1, end).replace(/\s+/g, " ").trim();
    // a lone label or heading-like line is not a place for a link: the words must sit in a real sentence
    if (sentence.split(" ").length < 6) return null;
    return { anchor: m[0], sentence: sentence.length > 240 ? `${sentence.slice(0, 237)}...` : sentence };
  };
  for (let len = words.length; len >= 2; len--) {
    for (let at = 0; at + len <= words.length; at++) {
      const run = words.slice(at, at + len);
      // starts on a real word; may end on "Sewa" or "Service" (they belong to the name) but not on a loose small word
      if (!nameStart(run[0]) || run[run.length - 1].length < 3 || /^(and|the|for|with|from|our|your)$/i.test(run[run.length - 1])) continue;
      const hit = tryPhrase(run.join(" "));
      if (hit) return hit;
    }
  }
  for (const w of words) {
    // a single word only when it is distinctive: a word most pages use ("travel", "planning") is not a link text
    if (w.length < 6 || !solid(w) || !isDistinct(w)) continue;
    const hit = tryPhrase(w);
    if (hit) return hit;
  }
  return null;
}

export const internalLinkingService = {
  /** Recompute suggestions from the real corpus and store them; applied / dismissed decisions are kept. */
  async generate() {
    const docs = await buildCorpus();
    if (docs.length < 2) return { pagesAnalysed: docs.length, created: 0, message: "Not enough crawled page content yet. Run an audit first." };
    // the match is decided by what the WHOLE page content means (AI embeddings), not by words in common
    const vectors = await embedTexts(docs.map((d) => `${d.title}\n${d.text}`));
    const suggestions = suggestLinks(docs, { vectors });
    let created = 0;
    for (const s of suggestions) {
      const r = await InternalLinkSuggestion.updateOne(
        { fromPath: s.fromPath, toPath: s.toPath },
        {
          $set: {
            similarity: s.similarity,
            sharedTerms: s.sharedTerms,
            fromTitle: s.fromTitle,
            toTitle: s.toTitle,
            fromExcerpt: s.fromExcerpt,
            toExcerpt: s.toExcerpt,
            contextSnippets: s.contextSnippets,
          },
          $setOnInsert: { anchorText: s.anchorText, anchorPlaced: s.anchorPlaced, anchorContext: s.anchorContext, status: "suggested" },
        },
        { upsert: true }
      );
      // a suggestion nobody has applied yet follows the newest page text; an applied one keeps the words it was applied with
      await InternalLinkSuggestion.updateOne({ fromPath: s.fromPath, toPath: s.toPath, status: "suggested" }, { $set: { anchorText: s.anchorText, anchorPlaced: s.anchorPlaced, anchorContext: s.anchorContext } });
      if (r.upsertedCount) created += 1;
    }
    // suggestions computed the old way (or no longer matching) are dropped; applied and dismissed decisions are kept
    const keep = suggestions.map((x) => ({ fromPath: x.fromPath, toPath: x.toPath }));
    await InternalLinkSuggestion.deleteMany({ status: "suggested", ...(keep.length ? { $nor: keep } : {}) });
    return {
      pagesAnalysed: docs.length,
      created,
      method: vectors ? ("full_content_embedding" as const) : ("word_overlap" as const),
      message: vectors ? null : "No AI embedding service answered, so the match was estimated from words in common. Try again later for a whole-content match.",
    };
  },

  async list(status?: string) {
    const filter: any = status && ["suggested", "applied", "dismissed"].includes(status) ? { status } : {};
    let items = await InternalLinkSuggestion.find(filter).sort({ similarity: -1 }).limit(500).lean();

    // Auto-enrich existing items if they are missing fromExcerpt or contextSnippets
    const needsEnrich = items.some(
      (it: any) => !it.fromExcerpt || !it.toExcerpt || !it.contextSnippets || it.contextSnippets.length === 0
    );
    if (needsEnrich && items.length > 0) {
      try {
        const docs = await buildCorpus();
        const docByPath = new Map(docs.map((d) => [d.path, d]));
        const bulkOps: any[] = [];
        items = items.map((it: any) => {
          const fromDoc = docByPath.get(it.fromPath);
          const toDoc = docByPath.get(it.toPath);
          if (!fromDoc || !toDoc) return it;

          const fromTitle = it.fromTitle || fromDoc.title || it.fromPath;
          const toTitle = it.toTitle || toDoc.title || it.toPath;
          const fromExcerpt = it.fromExcerpt || fromDoc.excerpt || cleanExcerpt(fromDoc.text, 280);
          const toExcerpt = it.toExcerpt || toDoc.excerpt || cleanExcerpt(toDoc.text, 280);
          const contextSnippets =
            it.contextSnippets && it.contextSnippets.length > 0
              ? it.contextSnippets
              : (it.sharedTerms || []).slice(0, 4).map((t: string) => ({
                  term: t,
                  fromSentence: extractContextSentence(fromDoc.text, t),
                  toSentence: extractContextSentence(toDoc.text, t),
                }));

          bulkOps.push({
            updateOne: {
              filter: { _id: it._id },
              update: { $set: { fromTitle, toTitle, fromExcerpt, toExcerpt, contextSnippets } },
            },
          });

          return { ...it, fromTitle, toTitle, fromExcerpt, toExcerpt, contextSnippets };
        });

        if (bulkOps.length > 0) {
          InternalLinkSuggestion.bulkWrite(bulkOps).catch(() => {});
        }
      } catch {
        /* fallback to raw items */
      }
    }

    return items;
  },

  async setStatus(id: string, status: "applied" | "suggested" | "dismissed", user: string) {
    const set: any = { status };
    if (status === "applied") {
      set.appliedBy = user;
      set.appliedAt = new Date();
    }
    const doc = await InternalLinkSuggestion.findByIdAndUpdate(id, { $set: set }, { returnDocument: "after" });
    // the website reads applied links from the public overrides: they must answer fresh right away
    clearDeliveryCache();
    return doc;
  },

  async appliedFor(routePath?: string) {
    const filter: any = { status: "applied" };
    if (routePath) filter.fromPath = routePath;
    return InternalLinkSuggestion.find(filter).select("fromPath toPath anchorText anchorPlaced").lean();
  },
};

export { pageKeyOf };
