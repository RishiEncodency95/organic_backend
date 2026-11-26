import crypto from "node:crypto";
import * as cheerio from "cheerio";
import { activeBusinessConfig, matchServiceCategories } from "../taxonomy";
import { normalizePageUrl, sameSite } from "./url";

/*
 * Deterministic page extraction. Everything here is read from the HTML that was fetched; nothing is inferred.
 * Crawled HTML is untrusted DATA: it is parsed, bounded and excerpted, never executed or treated as instructions.
 */

export const LIMITS = {
  text: 20_000,
  excerpt: 240,
  headings: 80,
  links: 300,
  ctas: 40,
  prices: 40,
  faqs: 30,
  jsonLd: 20,
  mentions: 40,
} as const;

export interface PriceClaim {
  raw: string;
  amount: number | null;
  currency: "INR" | "USD" | "OTHER";
  startingFrom: boolean;
  tax: "inclusive" | "exclusive" | "unstated";
  unit: string | null;
  excerpt: string;
}

export interface FormInfo {
  fieldCount: number;
  requiredCount: number;
  fields: { name: string; type: string; required: boolean }[];
}

export interface PageExtract {
  url: string;
  lang: string | null;
  title: string | null;
  metaDescription: string | null;
  canonical: string | null;
  robotsMeta: string | null;
  viewport: boolean;
  og: { title: string | null; description: string | null; image: string | null; siteName: string | null };
  hreflang: string[];
  headings: { level: number; text: string }[];
  h1Count: number;
  jsonLd: { types: string[]; validBlocks: number; invalidBlocks: number };
  phones: { value: string; source: "tel_link" | "text"; excerpt: string }[];
  emails: { value: string; source: "mailto_link" | "text"; excerpt: string }[];
  whatsappLinks: string[];
  forms: FormInfo[];
  ctas: string[];
  internalLinks: { href: string; text: string }[];
  externalLinks: { href: string; text: string }[];
  socialLinks: { platform: string; href: string }[];
  images: { total: number; withAlt: number; missingAltSamples: string[] };
  text: string;
  wordCount: number;
  prices: PriceClaim[];
  faqs: { question: string; answer: string; source: "jsonld" | "details" | "heading" }[];
  serviceMentions: { category: string; excerpt: string }[];
  hoursClaims: string[];
  testimonialSignals: string[];
  addresses: string[];
  placeMentions: string[];
  latestDate: string | null;
  scriptCount: number;
  looksLikeJsShell: boolean;
  contentHash: string;
}

const clean = (s: string | undefined | null) => (s ?? "").replace(/\s+/g, " ").trim();
const cap = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);
export const sha256 = (s: string) => crypto.createHash("sha256").update(s).digest("hex");

/** A bounded excerpt of `text` around the first occurrence of `needle` (case-insensitive). */
export function excerptAround(text: string, needle: string | RegExp, max: number = LIMITS.excerpt): string {
  const lower = text.toLowerCase();
  let idx = -1;
  let len = 0;
  if (typeof needle === "string") {
    idx = lower.indexOf(needle.toLowerCase());
    len = needle.length;
  } else {
    const m = needle.exec(text);
    if (m) {
      idx = m.index;
      len = m[0].length;
    }
  }
  if (idx < 0) return "";
  const half = Math.max(0, Math.floor((max - len) / 2));
  const start = Math.max(0, idx - half);
  const end = Math.min(text.length, idx + len + half);
  return `${start > 0 ? "…" : ""}${text.slice(start, end).trim()}${end < text.length ? "…" : ""}`;
}

const CTA = /\b(call( now| us)?|whatsapp|book( now)?|enquire|enquiry|inquire|get (a )?(quote|call ?back|help)|contact( us)?|request|talk to|chat|schedule|reserve|pre-?book)\b|कॉल करें|संपर्क करें|बुक करें/i;
const SOCIAL: [string, RegExp][] = [
  ["facebook", /(^|\.)facebook\.com$/],
  ["instagram", /(^|\.)instagram\.com$/],
  ["youtube", /(^|\.)(youtube\.com|youtu\.be)$/],
  ["linkedin", /(^|\.)linkedin\.com$/],
  ["x", /(^|\.)(twitter\.com|x\.com)$/],
  ["pinterest", /(^|\.)pinterest\./],
];
const PHONE_TEXT = /(?:\+?91[\s-]?)?(?:\(?0?\d{2,4}\)?[\s-]?)?\b[6-9]\d{4}[\s-]?\d{5}\b|\b1800[\s-]?\d{3}[\s-]?\d{4}\b/g;
const EMAIL_TEXT = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const PRICE = /(₹|\brs\.?|\binr\b|\busd\b|\$)\s?(\d[\d,]*(?:\.\d+)?)(\s?\/-)?|\b(\d[\d,]{2,}(?:\.\d+)?)\s?(\/-|rupees|inr\b)/gi;
const HOURS = /\b24\s?[x×*\/]\s?7\b|\b24 ?hours?\b|\bround the clock\b|\b(open|available) (all|every) days?\b|\b\d{1,2}(:\d{2})?\s?(am|pm)\s?(-|to|–)\s?\d{1,2}(:\d{2})?\s?(am|pm)\b|24 घंटे/gi;
const TESTIMONIAL_HINT = /testimonial|review|what (our )?(clients|customers|families) say|feedback|ग्राहकों की राय/i;

function priceClaims(text: string): PriceClaim[] {
  const out: PriceClaim[] = [];
  const seen = new Set<string>();
  PRICE.lastIndex = 0;
  const matches = [...text.matchAll(PRICE)].slice(0, LIMITS.prices * 2);
  for (let i = 0; i < matches.length && out.length < LIMITS.prices; i += 1) {
    const m = matches[i];
    const idx = m.index ?? 0;
    const raw = m[0].trim();
    const digits = (m[2] ?? m[4] ?? "").replace(/,/g, "");
    const amount = digits ? Number(digits) : null;
    if (amount !== null && (!Number.isFinite(amount) || amount <= 0)) continue;
    // ignore phone-number-like and year-like numbers written without a currency marker
    if (!m[1] && amount !== null && (amount < 100 || /^(19|20)\d{2}$/.test(digits))) continue;
    const symbol = (m[1] ?? m[5] ?? "").toLowerCase();
    const currency = symbol.includes("usd") || symbol === "$" ? "USD" : symbol ? "INR" : "OTHER";
    // Qualifier window: this claim only — never past the previous / next price claim or a sentence end.
    const prevEnd = i > 0 ? (matches[i - 1].index ?? 0) + matches[i - 1][0].length : 0;
    const nextStart = i + 1 < matches.length ? (matches[i + 1].index ?? text.length) : text.length;
    let from = Math.max(prevEnd, idx - 70);
    let to = Math.min(nextStart, idx + raw.length + 70);
    const before = text.slice(from, idx);
    const stop = Math.max(before.lastIndexOf(". "), before.lastIndexOf("! "), before.lastIndexOf("? "));
    if (stop >= 0 && !/(rs|inr)$/i.test(before.slice(0, stop))) from += stop + 2;
    const after = text.slice(idx + raw.length, to);
    const end = after.search(/[.!?](s|$)/);
    if (end >= 0) to = idx + raw.length + end;
    const window = text.slice(from, to).toLowerCase();
    const unitMatch = /\bper\s+(day|km|kilomet(er|re)|hour|hr|person|trip|night|kg)\b|\/(day|km|hr|hour|person|trip)\b/.exec(window);
    const claim: PriceClaim = {
      raw,
      amount,
      currency,
      startingFrom: /\b(starting|starts?|from|onwards|minimum|min\.?)\b|से शुरू/.test(window),
      tax: /\b(incl(usive|\.)?|including)\b[^.]{0,20}\b(gst|tax(es)?)\b|\ball (taxes )?inclusive\b/.test(window)
        ? "inclusive"
        : /(\+|plus|excl(usive|\.)?|excluding|extra)\s*\b(gst|tax(es)?)\b/.test(window)
          ? "exclusive"
          : "unstated",
      unit: unitMatch ? (unitMatch[1] ?? unitMatch[3] ?? null) : null,
      excerpt: excerptAround(text, raw),
    };
    const key = `${claim.raw}|${claim.excerpt}`;
    if (!seen.has(key)) {
      seen.add(key);
      out.push(claim);
    }
  }
  return out;
}

function jsonLdBlocks($: cheerio.CheerioAPI) {
  const types = new Set<string>();
  let valid = 0;
  let invalid = 0;
  const faqs: PageExtract["faqs"] = [];
  const addresses: string[] = [];
  const dates: string[] = [];
  const visit = (node: unknown, depth = 0): void => {
    if (!node || typeof node !== "object" || depth > 8) return;
    if (Array.isArray(node)) return node.slice(0, 50).forEach((n) => visit(n, depth + 1));
    const obj = node as Record<string, unknown>;
    const t = obj["@type"];
    for (const ty of Array.isArray(t) ? t : t ? [t] : []) if (typeof ty === "string" && types.size < 40) types.add(ty);
    if (t === "Question" && typeof obj.name === "string") {
      const ans = obj.acceptedAnswer as Record<string, unknown> | undefined;
      const answer = typeof ans?.text === "string" ? cheerio.load(ans.text).text() : "";
      if (faqs.length < LIMITS.faqs) faqs.push({ question: cap(clean(obj.name), 300), answer: cap(clean(answer), 600), source: "jsonld" });
    }
    if (t === "PostalAddress") {
      const parts = ["streetAddress", "addressLocality", "addressRegion", "postalCode", "addressCountry"]
        .map((k) => (typeof obj[k] === "string" ? clean(obj[k] as string) : ""))
        .filter(Boolean);
      if (parts.length && addresses.length < 10) addresses.push(cap(parts.join(", "), 300));
    }
    for (const k of ["dateModified", "datePublished"]) if (typeof obj[k] === "string") dates.push(obj[k] as string);
    for (const v of Object.values(obj)) if (v && typeof v === "object") visit(v, depth + 1);
  };
  $('script[type="application/ld+json"]').each((i, el) => {
    if (i >= LIMITS.jsonLd) return false;
    const raw = $(el).text();
    try {
      visit(JSON.parse(raw));
      valid += 1;
    } catch {
      invalid += 1;
    }
    return undefined;
  });
  return { types: [...types], valid, invalid, faqs, addresses, dates };
}

function visibleText($: cheerio.CheerioAPI): string {
  const body = $("body").clone();
  body.find("script, style, noscript, template, svg, iframe, canvas").remove();
  // keep block boundaries as spaces so words don't glue together
  body.find("br, p, div, li, h1, h2, h3, h4, h5, h6, tr, section, article, header, footer, nav, td, th, dd, dt").each((_, el) => {
    $(el).append(" ");
  });
  return clean(body.text());
}

export function extractPage(html: string, pageUrl: string, now = new Date()): PageExtract {
  const $ = cheerio.load(html);
  const base = new URL(pageUrl);
  const meta = (sel: string) => clean($(sel).attr("content")) || null;
  const text = cap(visibleText($), LIMITS.text);
  const words = text ? text.split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w)).length : 0;

  const headings: PageExtract["headings"] = [];
  $("h1, h2, h3, h4, h5, h6").each((_, el) => {
    if (headings.length >= LIMITS.headings) return false;
    const t = cap(clean($(el).text()), 200);
    if (t) headings.push({ level: Number(el.tagName.slice(1)), text: t });
    return undefined;
  });

  const internalLinks: PageExtract["internalLinks"] = [];
  const externalLinks: PageExtract["externalLinks"] = [];
  const socialLinks: PageExtract["socialLinks"] = [];
  const whatsapp = new Set<string>();
  const phones: PageExtract["phones"] = [];
  const emails: PageExtract["emails"] = [];
  const seenLinks = new Set<string>();
  $("a[href]").each((_, el) => {
    const href = clean($(el).attr("href"));
    const label = cap(clean($(el).text()) || clean($(el).attr("aria-label")) || clean($(el).attr("title")), 120);
    if (/^tel:/i.test(href)) {
      const v = href.replace(/^tel:/i, "").replace(/[^\d+]/g, "");
      if (v.length >= 8 && phones.length < 20 && !phones.some((p) => p.value === v)) phones.push({ value: v, source: "tel_link", excerpt: label || href });
      return;
    }
    if (/^mailto:/i.test(href)) {
      const v = href.replace(/^mailto:/i, "").split("?")[0].toLowerCase();
      if (v.includes("@") && emails.length < 20 && !emails.some((e) => e.value === v)) emails.push({ value: v, source: "mailto_link", excerpt: label || href });
      return;
    }
    let u: URL;
    try {
      u = new URL(href, base);
    } catch {
      return;
    }
    if (!/^https?:$/.test(u.protocol)) return;
    if (/(^|\.)wa\.me$|(^|\.)whatsapp\.com$/.test(u.hostname)) {
      if (whatsapp.size < 10) whatsapp.add(cap(u.href, 300));
      return;
    }
    const social = SOCIAL.find(([, re]) => re.test(u.hostname));
    if (social && socialLinks.length < 20 && !socialLinks.some((s) => s.href === u.href)) socialLinks.push({ platform: social[0], href: cap(u.href, 300) });
    const norm = normalizePageUrl(u.href);
    if (!norm || seenLinks.has(norm)) return;
    seenLinks.add(norm);
    if (sameSite(u.hostname, base.hostname)) {
      if (internalLinks.length < LIMITS.links) internalLinks.push({ href: norm, text: label });
    } else if (externalLinks.length < LIMITS.links) externalLinks.push({ href: norm, text: label });
  });
  for (const m of text.matchAll(PHONE_TEXT)) {
    const v = m[0].replace(/[^\d+]/g, "");
    if (phones.length >= 20) break;
    if (!phones.some((p) => p.value.endsWith(v.slice(-10)))) phones.push({ value: v, source: "text", excerpt: excerptAround(text, m[0]) });
  }
  for (const m of text.matchAll(EMAIL_TEXT)) {
    const v = m[0].toLowerCase();
    if (emails.length >= 20) break;
    if (!/\.(png|jpe?g|webp|svg|gif)$/.test(v) && !emails.some((e) => e.value === v)) emails.push({ value: v, source: "text", excerpt: excerptAround(text, m[0]) });
  }

  const forms: FormInfo[] = [];
  $("form").each((_, form) => {
    if (forms.length >= 10) return false;
    const fields: FormInfo["fields"] = [];
    $(form)
      .find("input, select, textarea")
      .each((__, f) => {
        const type = (($(f).attr("type") || f.tagName) ?? "").toLowerCase();
        if (["hidden", "submit", "button", "reset", "image"].includes(type)) return;
        if (fields.length < 30) fields.push({ name: cap(clean($(f).attr("name") || $(f).attr("placeholder") || $(f).attr("id") || type), 60), type, required: $(f).is("[required]") || $(f).attr("aria-required") === "true" });
      });
    forms.push({ fieldCount: fields.length, requiredCount: fields.filter((f) => f.required).length, fields });
    return undefined;
  });

  const ctas: string[] = [];
  $("a, button, [role=button], input[type=submit]").each((_, el) => {
    if (ctas.length >= LIMITS.ctas) return false;
    const label = cap(clean($(el).text()) || clean($(el).attr("value")) || clean($(el).attr("aria-label")), 80);
    if (label && label.length <= 60 && CTA.test(label) && !ctas.includes(label)) ctas.push(label);
    return undefined;
  });

  let imgTotal = 0;
  let imgAlt = 0;
  const missingAlt: string[] = [];
  $("img").each((_, el) => {
    imgTotal += 1;
    const alt = $(el).attr("alt");
    if (alt !== undefined && clean(alt).length > 0) imgAlt += 1;
    else if (missingAlt.length < 10) missingAlt.push(cap(clean($(el).attr("src")), 200));
  });

  const ld = jsonLdBlocks($);
  const faqs = [...ld.faqs];
  $("details").each((_, el) => {
    if (faqs.length >= LIMITS.faqs) return false;
    const q = clean($(el).find("summary").first().text());
    const a = clean($(el).clone().find("summary").remove().end().text());
    if (q && q.length < 300) faqs.push({ question: q, answer: cap(a, 600), source: "details" });
    return undefined;
  });
  for (const h of headings) {
    if (faqs.length >= LIMITS.faqs) break;
    if (h.level >= 2 && /\?\s*$/.test(h.text) && !faqs.some((f) => f.question === h.text)) faqs.push({ question: h.text, answer: "", source: "heading" });
  }

  const serviceMentions: PageExtract["serviceMentions"] = [];
  for (const cat of activeBusinessConfig().serviceCategories) {
    for (const p of cat.patterns) {
      const re = new RegExp(p.source, "i");
      const ex = excerptAround(text, re);
      if (ex) {
        serviceMentions.push({ category: cat.id, excerpt: ex });
        break;
      }
    }
  }

  const hoursClaims = [...new Set([...text.matchAll(HOURS)].map((m) => excerptAround(text, m[0], 160)))].slice(0, 5);
  const testimonialSignals: string[] = [];
  $("[class], [id]").each((_, el) => {
    if (testimonialSignals.length >= 3) return false;
    const attr = `${$(el).attr("class") ?? ""} ${$(el).attr("id") ?? ""}`;
    if (/testimonial|review/i.test(attr)) {
      const t = cap(clean($(el).text()), 200);
      if (t.length > 30) testimonialSignals.push(t);
    }
    return undefined;
  });
  for (const h of headings) if (testimonialSignals.length < 3 && TESTIMONIAL_HINT.test(h.text)) testimonialSignals.push(h.text);

  const placeMentions = activeBusinessConfig().places.filter((p) => new RegExp(`(^|[^\\p{L}])${p.replace(/\s/g, "\\s")}([^\\p{L}]|$)`, "iu").test(text)).slice(0, LIMITS.mentions);
  const dateCandidates = [...ld.dates, meta('meta[property="article:modified_time"]') ?? "", meta('meta[property="article:published_time"]') ?? "", ...$("time[datetime]").map((_, el) => $(el).attr("datetime") ?? "").get()]
    .map((d) => new Date(d))
    .filter((d) => !Number.isNaN(d.getTime()) && d.getTime() <= now.getTime() + 86_400_000);
  const latestDate = dateCandidates.length ? new Date(Math.max(...dateCandidates.map((d) => d.getTime()))).toISOString().slice(0, 10) : null;
  const scriptCount = $("script[src], script:not([type='application/ld+json'])").length;
  const canonicalRaw = $('link[rel="canonical"]').attr("href");
  let canonical: string | null = null;
  if (canonicalRaw) {
    try {
      canonical = new URL(canonicalRaw, base).href;
    } catch {
      canonical = cap(clean(canonicalRaw), 300);
    }
  }

  return {
    url: pageUrl,
    lang: clean($("html").attr("lang")) || null,
    title: cap(clean($("head > title").first().text() || $("title").first().text()), 300) || null,
    metaDescription: meta('meta[name="description" i]') ? cap(meta('meta[name="description" i]') as string, 500) : null,
    canonical,
    robotsMeta: meta('meta[name="robots" i]'),
    viewport: $('meta[name="viewport" i]').length > 0,
    og: {
      title: meta('meta[property="og:title"]'),
      description: meta('meta[property="og:description"]'),
      image: meta('meta[property="og:image"]'),
      siteName: meta('meta[property="og:site_name"]'),
    },
    hreflang: $('link[rel="alternate"][hreflang]').map((_, el) => clean($(el).attr("hreflang"))).get().slice(0, 20),
    headings,
    h1Count: $("h1").length,
    jsonLd: { types: ld.types, validBlocks: ld.valid, invalidBlocks: ld.invalid },
    phones,
    emails,
    whatsappLinks: [...whatsapp],
    forms,
    ctas,
    internalLinks,
    externalLinks,
    socialLinks,
    images: { total: imgTotal, withAlt: imgAlt, missingAltSamples: missingAlt },
    text,
    wordCount: words,
    prices: priceClaims(text),
    faqs,
    serviceMentions,
    hoursClaims,
    testimonialSignals,
    addresses: ld.addresses,
    placeMentions,
    latestDate,
    scriptCount,
    looksLikeJsShell: words < 60 && (scriptCount >= 3 || $("#__next, #root, #app, [data-reactroot], app-root").length > 0),
    contentHash: sha256(text),
  };
}

/** The brand name a site uses for itself: og:site_name, else the first non-generic part of the home title. */
export function siteNameFrom(page: Pick<PageExtract, "og" | "title">): string | null {
  if (page.og.siteName) return cap(page.og.siteName, 120);
  const parts = (page.title ?? "").split(/\s[|\-–—:·]\s/).map(clean).filter(Boolean);
  const good = parts.find((p) => !/^(home|home ?page|welcome|index|main|official (web)?site)$/i.test(p));
  return good ? cap(good, 120) : null;
}

/** Service categories mentioned across text (used by discovery verification). */
export const servicesInText = (text: string) => matchServiceCategories(text);

