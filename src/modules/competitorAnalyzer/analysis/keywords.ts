import { matchServiceCategories } from "../taxonomy";

/*
 * Keyword intelligence (Engine 6). Deterministic normalisation, language detection, intent classification,
 * clustering by service category, city grouping and page matching. Keyword IDEAS are not measured demand:
 * search volume, difficulty, CPC and position are always "not_available" unless a real provider supplies them.
 */

export type Intent = "informational" | "transactional" | "navigational" | "commercial" | "urgent" | "local";

const CITIES = ["delhi", "new delhi", "delhi ncr", "ncr", "noida", "greater noida", "ghaziabad", "gurgaon", "gurugram", "faridabad", "meerut", "mumbai", "pune", "bangalore", "bengaluru", "hyderabad", "chennai", "kolkata", "lucknow", "jaipur", "chandigarh", "haridwar", "rishikesh", "varanasi", "prayagraj", "gaya", "patna", "india", "दिल्ली", "नोएडा", "गाजियाबाद", "हरिद्वार", "वाराणसी"];
const HINGLISH = /\b(antim|sanskar|asthi|visarjan|pind|daan|shradh|shraddh|tehrvi|terahvi|pandit|samagri|kaise|kya|kahan|kaha|karein|kare|wala|wale|ke liye|mein|seva|sewa|turant|ghat)\b/i;
const BRANDS = /\b(moksha ?voyage|mokshavoyage)\b/i;

export function normalizeKeyword(raw: string): string {
  return raw.normalize("NFC").toLowerCase().replace(/[“”"'`]/g, "").replace(/[^\p{L}\p{N}\p{M}\s?-]/gu, " ").replace(/\s+/g, " ").trim().slice(0, 120);
}

export function detectLanguage(k: string): "en" | "hi" | "hinglish" {
  if (/[ऀ-ॿ]/.test(k)) return "hi";
  if (HINGLISH.test(k)) return "hinglish";
  return "en";
}

export function classifyIntent(k: string): { intent: Intent; city: string | null; isQuestion: boolean } {
  const city = CITIES.find((c) => new RegExp(`(^|\\s)${c}(\\s|$)`, "i").test(k)) ?? null;
  const isQuestion = /\?$|^(how|what|why|when|where|which|who|can|is|are|do|does|kaise|kya|kab|kahan|kaun)\b|कैसे|क्या|कब|कहाँ/.test(k);
  let intent: Intent = "informational";
  if (BRANDS.test(k)) intent = "navigational";
  else if (/\b(urgent|emergency|immediate|now|tonight|24 ?x ?7|24\/7|24 hours|turant|abhi)\b|तुरंत/.test(k)) intent = "urgent";
  else if (/\b(best|top|vs|versus|compare|comparison|review|reviews|cheapest|affordable)\b/.test(k)) intent = "commercial";
  else if (/\b(book|booking|price|prices|cost|charges|rate|package|packages|hire|near me|service|services|provider|contact|number|online)\b|सेवा|बुक/.test(k)) intent = "transactional";
  else if (isQuestion || /\b(process|guide|rituals?|meaning|steps|documents?|rules|list|vidhi)\b|विधि|नियम/.test(k)) intent = "informational";
  else if (city) intent = "local";
  return { intent, city, isQuestion };
}

export interface KeywordRecord {
  normalized: string;
  keyword: string;
  language: "en" | "hi" | "hinglish";
  intent: Intent;
  city: string | null;
  isQuestion: boolean;
  cluster: string;
  serviceCategory: string | null;
  source: "seed" | "crawl_heading" | "ai_idea" | "manual" | "gsc";
}

export function buildKeywordRecord(raw: string, source: KeywordRecord["source"]): KeywordRecord | null {
  const normalized = normalizeKeyword(raw);
  if (normalized.length < 3 || normalized.split(" ").length > 12) return null;
  const { intent, city, isQuestion } = classifyIntent(normalized);
  const cats = matchServiceCategories(normalized);
  return { normalized, keyword: raw.trim().slice(0, 120), language: detectLanguage(normalized), intent, city, isQuestion, cluster: cats[0] ?? "general", serviceCategory: cats[0] ?? null, source };
}

const STOP = new Set(["in", "for", "the", "a", "an", "of", "and", "to", "near", "me", "services", "service", "india", "best", "top", "ke", "liye", "ki", "ka", "mein", "se"]);
const tokens = (s: string) => new Set(normalizeKeyword(s).split(" ").filter((t) => t.length > 2 && !STOP.has(t)));

/** Pages whose title / H1 / headings share ≥60% of the keyword's meaningful tokens. Evidence-based, not a ranking. */
export function matchPages(keyword: string, pages: { url: string; title: string | null; headings: string[] }[]): { url: string; title: string; match: string }[] {
  const kt = tokens(keyword);
  if (!kt.size) return [];
  const out: { url: string; title: string; match: string; score: number }[] = [];
  for (const p of pages) {
    const candidates = [p.title ?? "", ...p.headings];
    let best = 0;
    let bestText = "";
    for (const c of candidates) {
      const ct = tokens(c);
      const hit = [...kt].filter((t) => ct.has(t)).length / kt.size;
      if (hit > best) {
        best = hit;
        bestText = c;
      }
    }
    if (best >= 0.6) out.push({ url: p.url, title: p.title ?? p.url, match: bestText.slice(0, 160), score: best });
  }
  return out.sort((a, b) => b.score - a.score).slice(0, 5).map(({ score: _s, ...r }) => r);
}

/** Candidate keywords from crawled headings (H1–H3) that mention a configured service. */
export function headingKeywords(headings: string[]): string[] {
  return [...new Set(headings.filter((h) => h.length >= 8 && h.length <= 90 && matchServiceCategories(h).length > 0).map((h) => h.replace(/[|:–—-].*$/, "").trim()))].slice(0, 60);
}
