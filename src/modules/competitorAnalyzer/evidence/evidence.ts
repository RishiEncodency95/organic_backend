import { ANALYZER_VERSIONS } from "../config";
import type { CrawledPage, SiteCrawl } from "../crawler/crawler";
import type { PageExtract, PriceClaim } from "../crawler/extract";
import { activeBusinessConfig } from "../taxonomy";

/*
 * Evidence model (EVIDENCE_SCHEMA.md). A feature assertion never turns "not seen in the pages we read" into
 * "the business does not have it":
 *   present          – seen on at least one read page (with source URL + excerpt)
 *   absent_confirmed – not seen AND the page kinds where it would normally appear were read successfully, statically
 *                      complete (no JS shell), so the absence is supported by coverage rules
 *   not_observed     – not seen, but coverage is insufficient to conclude absence
 *   render_failed    – the relevant pages needed JavaScript rendering that failed / was unavailable
 *   fetch_failed     – the site (or every relevant page) could not be fetched
 *   provider_unavailable / not_applicable – for provider-backed or out-of-scope facts
 */

export type EvidenceState = "present" | "absent_confirmed" | "not_observed" | "render_failed" | "fetch_failed" | "provider_unavailable" | "not_applicable";

export interface EvidenceRef {
  url: string;
  excerpt: string;
  /** Verbatim visible page text, when available. Structural observations are not presented as quotations. */
  quote?: string;
  method: "static" | "rendered";
  contentHash: string;
  extractedAt: string;
}

export interface FeatureAssertion {
  state: EvidenceState;
  evidence: EvidenceRef[];
  /** Why the state was chosen (shown in the UI). */
  basis: string;
}

export const FEATURE_KEYS = [
  "phone", "email", "whatsapp", "contactForm", "clickToCall", "address", "operatingHours", "pricing", "packages",
  "faq", "testimonials", "blog", "aboutPage", "servicesPage", "contactPage", "privacyPolicy", "termsPolicy",
  "refundPolicy", "locationPages", "structuredData", "hindiContent", "socialLinks",
] as const;
export type FeatureKey = (typeof FEATURE_KEYS)[number];

export interface ServiceFact {
  category: string;
  label: string;
  state: EvidenceState;
  evidence: EvidenceRef[];
}

export interface PriceFact extends PriceClaim {
  sourceUrl: string;
  pageKind: string;
  contentHash: string;
  extractedAt: string;
  validator: "regex_quote_verified";
}

export interface SiteEvidence {
  domain: string;
  role: "own" | "competitor";
  rootUrl: string;
  siteName: string | null;
  crawlState: SiteCrawl["state"];
  crawlError: string | null;
  features: Record<FeatureKey, FeatureAssertion>;
  services: ServiceFact[];
  prices: PriceFact[];
  places: { place: string; evidence: EvidenceRef[] }[];
  addresses: EvidenceRef[];
  faqs: { question: string; answer: string; url: string }[];
  metrics: {
    pagesRead: number;
    totalWords: number;
    homeWords: number | null;
    ctaCount: number;
    distinctCtas: string[];
    formFieldMax: number | null;
    formRequiredMax: number | null;
    internalLinksHome: number | null;
    imagesTotal: number;
    imagesWithAlt: number;
    schemaTypes: string[];
  };
  extractorVersion: string;
}

const literalExcerpt = (s: string) => s.replace(/^(?:…|â€¦)|(?:…|â€¦)$/g, "").trim();
const ref = (p: CrawledPage, excerpt: string): EvidenceRef => ({
  url: p.finalUrl ?? p.url,
  excerpt: excerpt.slice(0, 280),
  ...(p.extract?.text.includes(literalExcerpt(excerpt)) && literalExcerpt(excerpt).length >= 5 ? { quote: literalExcerpt(excerpt).slice(0, 280) } : {}),
  method: p.method,
  contentHash: p.extract?.contentHash ?? "",
  extractedAt: p.fetchedAt,
});

type Finder = (x: PageExtract, p: CrawledPage) => string | null;

interface FeatureRule {
  key: FeatureKey;
  find: Finder;
  /** Page kinds whose successful static read supports an absence conclusion. Empty = absence can never be confirmed. */
  absenceKinds: string[];
  /** Absence also requires at least this many pages read. */
  minPagesForAbsence?: number;
}

const kindIs = (...kinds: string[]): Finder => (_x, p) => (kinds.includes(p.kind) ? `Page classified as ${p.kind}: ${p.extract?.title ?? p.url}` : null);
const textMatch = (re: RegExp): Finder => (x) => {
  const m = re.exec(x.text);
  if (!m) return null;
  const i = m.index;
  return x.text.slice(Math.max(0, i - 80), i + m[0].length + 80).trim();
};

const RULES: FeatureRule[] = [
  { key: "phone", find: (x) => (x.phones[0] ? `${x.phones[0].value} (${x.phones[0].source}) ${x.phones[0].excerpt}` : null), absenceKinds: ["home", "contact"] },
  { key: "email", find: (x) => (x.emails[0] ? `${x.emails[0].value} (${x.emails[0].source})` : null), absenceKinds: ["home", "contact"] },
  { key: "whatsapp", find: (x) => (x.whatsappLinks[0] ? `WhatsApp link: ${x.whatsappLinks[0]}` : null), absenceKinds: ["home", "contact"] },
  { key: "clickToCall", find: (x) => { const t = x.phones.find((p) => p.source === "tel_link"); return t ? `tel: link ${t.value} "${t.excerpt}"` : null; }, absenceKinds: ["home", "contact"] },
  { key: "contactForm", find: (x) => (x.forms.some((f) => f.fieldCount >= 2) ? `Form with ${x.forms.find((f) => f.fieldCount >= 2)!.fieldCount} visible fields` : null), absenceKinds: ["home", "contact"] },
  { key: "address", find: (x) => x.addresses[0] ?? textMatch(/\b(address|registered office|head office|office|पता)\s*[:\-–]\s*\S|\b(delhi|noida|ghaziabad|gurugram|gurgaon|faridabad|india|pradesh|haryana|uttarakhand|bihar|maharashtra|karnataka|rajasthan)\b[\s,\-–]{1,4}[1-9]\d{2}\s?\d{3}\b/i)(x, {} as CrawledPage), absenceKinds: ["contact", "about"] },
  { key: "operatingHours", find: (x) => x.hoursClaims[0] ?? null, absenceKinds: ["home", "contact"] },
  { key: "pricing", find: (x) => (x.prices[0] ? x.prices[0].excerpt : null), absenceKinds: ["pricing", "services", "service_detail"], minPagesForAbsence: 3 },
  { key: "packages", find: (x) => textMatch(/\b(package|plan)s?\b[^.]{0,60}\b(include|inclusion|₹|rs\.?|starting)|पैकेज/i)(x, {} as CrawledPage) ?? (x.headings.find((h) => /\bpackage|पैकेज/i.test(h.text))?.text ?? null), absenceKinds: ["pricing", "services"], minPagesForAbsence: 3 },
  { key: "faq", find: (x) => (x.faqs[0] ? `Q: ${x.faqs[0].question}` : null), absenceKinds: [] },
  { key: "testimonials", find: (x) => x.testimonialSignals[0] ?? null, absenceKinds: [] },
  { key: "blog", find: kindIs("blog"), absenceKinds: [] },
  { key: "aboutPage", find: kindIs("about"), absenceKinds: [] },
  { key: "servicesPage", find: kindIs("services", "service_detail"), absenceKinds: [] },
  { key: "contactPage", find: kindIs("contact"), absenceKinds: [] },
  { key: "privacyPolicy", find: (x, p) => (/privacy/i.test(p.url) ? `Privacy page: ${p.url}` : x.internalLinks.find((l) => /privacy/i.test(l.href + l.text)) ? `Linked: ${x.internalLinks.find((l) => /privacy/i.test(l.href + l.text))!.href}` : null), absenceKinds: ["home"] },
  { key: "termsPolicy", find: (x, p) => (/terms|conditions/i.test(p.url) ? `Terms page: ${p.url}` : x.internalLinks.find((l) => /terms|conditions/i.test(l.href + l.text)) ? `Linked: ${x.internalLinks.find((l) => /terms|conditions/i.test(l.href + l.text))!.href}` : null), absenceKinds: ["home"] },
  { key: "refundPolicy", find: (x, p) => (/refund|cancellation/i.test(p.url) ? `Refund page: ${p.url}` : x.internalLinks.find((l) => /refund|cancellation/i.test(l.href + l.text)) ? `Linked: ${x.internalLinks.find((l) => /refund|cancellation/i.test(l.href + l.text))!.href}` : null), absenceKinds: ["home"] },
  { key: "locationPages", find: kindIs("locations"), absenceKinds: [] },
  { key: "structuredData", find: (x) => (x.jsonLd.types.length ? `JSON-LD types: ${x.jsonLd.types.slice(0, 6).join(", ")}` : null), absenceKinds: ["home"] },
  { key: "hindiContent", find: (x) => (/[ऀ-ॿ]{3,}/.test(x.text) ? textMatch(/[ऀ-ॿ][ऀ-ॿ\s]{8,}/)(x, {} as CrawledPage) : x.lang?.startsWith("hi") ? `html lang="${x.lang}"` : null), absenceKinds: [], minPagesForAbsence: 99 },
  { key: "socialLinks", find: (x) => (x.socialLinks[0] ? `${x.socialLinks[0].platform}: ${x.socialLinks[0].href}` : null), absenceKinds: ["home"] },
];

function assertFeature(rule: FeatureRule, crawl: SiteCrawl): FeatureAssertion {
  if (crawl.state !== "ok" && crawl.state !== "cancelled") {
    return { state: crawl.state === "robots_disallowed" ? "not_observed" : "fetch_failed", evidence: [], basis: `Site not read (${crawl.state}).` };
  }
  const evidence: EvidenceRef[] = [];
  for (const p of crawl.pages) {
    if (!p.extract || (p.state !== "read" && p.state !== "render_failed")) continue;
    const found = rule.find(p.extract, p);
    if (found && evidence.length < 3) evidence.push(ref(p, found));
  }
  if (evidence.length) return { state: "present", evidence, basis: `Seen on ${evidence.length} read page(s).` };
  const relevant = crawl.pages.filter((p) => rule.absenceKinds.includes(p.kind));
  const jsBlocked = crawl.pages.some((p) => rule.absenceKinds.includes(p.kind) && (p.state === "render_failed" || (p.extract?.looksLikeJsShell && p.method === "static")));
  if (jsBlocked) return { state: "render_failed", evidence: [], basis: "Relevant pages need JavaScript rendering; content not verified." };
  const readStatic = rule.absenceKinds.filter((k) => crawl.pages.some((p) => p.kind === k && p.state === "read"));
  const enoughPages = crawl.coverage.read >= (rule.minPagesForAbsence ?? 2);
  if (rule.absenceKinds.length && readStatic.length === rule.absenceKinds.length && enoughPages) {
    return { state: "absent_confirmed", evidence: [], basis: `Not found on the read ${readStatic.join(", ")} page(s) (rule: those page kinds read successfully).` };
  }
  if (relevant.length && relevant.every((p) => p.state !== "read")) return { state: "fetch_failed", evidence: [], basis: "Relevant pages could not be fetched." };
  return { state: "not_observed", evidence: [], basis: "Not found in the sampled pages; coverage is not sufficient to conclude absence." };
}

export function buildSiteEvidence(crawl: SiteCrawl, role: "own" | "competitor"): SiteEvidence {
  const features = Object.fromEntries(RULES.map((r) => [r.key, assertFeature(r, crawl)])) as Record<FeatureKey, FeatureAssertion>;
  const read = crawl.pages.filter((p) => p.extract && (p.state === "read" || p.state === "render_failed"));
  const home = crawl.pages.find((p) => p.kind === "home" && p.extract);

  const services: ServiceFact[] = activeBusinessConfig().serviceCategories.map((cat) => {
    const evidence: EvidenceRef[] = [];
    for (const p of read) {
      const m = p.extract!.serviceMentions.find((s) => s.category === cat.id);
      if (m && evidence.length < 3) evidence.push(ref(p, m.excerpt));
    }
    const state: EvidenceState = evidence.length ? "present" : crawl.state === "ok" ? "not_observed" : "fetch_failed";
    return { category: cat.id, label: cat.label, state, evidence };
  });

  const prices: PriceFact[] = [];
  for (const p of read) {
    for (const c of p.extract!.prices) {
      // Quote verification: the raw price string must occur inside the stored excerpt AND the page text.
      if (!c.excerpt.includes(c.raw) || !p.extract!.text.includes(c.raw)) continue;
      if (prices.length < 60) prices.push({ ...c, sourceUrl: p.finalUrl ?? p.url, pageKind: p.kind, contentHash: p.extract!.contentHash, extractedAt: p.fetchedAt, validator: "regex_quote_verified" });
    }
  }

  const placeMap = new Map<string, EvidenceRef[]>();
  for (const p of read) for (const place of p.extract!.placeMentions) {
    const list = placeMap.get(place) ?? [];
    if (list.length < 2) {
      const i = p.extract!.text.toLowerCase().indexOf(place.toLowerCase());
      list.push(ref(p, i >= 0 ? p.extract!.text.slice(Math.max(0, i - 60), i + place.length + 60) : place));
    }
    placeMap.set(place, list);
  }

  const ctas = [...new Set(read.flatMap((p) => p.extract!.ctas))];
  const forms = read.flatMap((p) => p.extract!.forms).filter((f) => f.fieldCount >= 2);
  return {
    domain: crawl.domain,
    role,
    rootUrl: crawl.rootUrl,
    siteName: crawl.siteName,
    crawlState: crawl.state,
    crawlError: crawl.error,
    features,
    services,
    prices,
    places: [...placeMap.entries()].map(([place, evidence]) => ({ place, evidence })).slice(0, 40),
    addresses: read.flatMap((p) => p.extract!.addresses.map((a) => ref(p, a))).slice(0, 10),
    faqs: read.flatMap((p) => p.extract!.faqs.map((f) => ({ ...f, url: p.finalUrl ?? p.url }))).slice(0, 40),
    metrics: {
      pagesRead: crawl.coverage.read,
      totalWords: read.reduce((s, p) => s + p.extract!.wordCount, 0),
      homeWords: home?.extract?.wordCount ?? null,
      ctaCount: ctas.length,
      distinctCtas: ctas.slice(0, 30),
      formFieldMax: forms.length ? Math.max(...forms.map((f) => f.fieldCount)) : null,
      formRequiredMax: forms.length ? Math.max(...forms.map((f) => f.requiredCount)) : null,
      internalLinksHome: home?.extract?.internalLinks.length ?? null,
      imagesTotal: read.reduce((s, p) => s + p.extract!.images.total, 0),
      imagesWithAlt: read.reduce((s, p) => s + p.extract!.images.withAlt, 0),
      schemaTypes: [...new Set(read.flatMap((p) => p.extract!.jsonLd.types))].slice(0, 30),
    },
    extractorVersion: ANALYZER_VERSIONS.extractor,
  };
}
