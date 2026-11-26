import { ANALYZER_VERSIONS } from "../config";
import type { SiteCrawl } from "../crawler/crawler";
import { sameSite } from "../crawler/url";
import type { EvidenceState, FeatureKey, SiteEvidence } from "../evidence/evidence";
import type { SpeedResult } from "../providers/pagespeed";
import { CONTENT_QUALITY_CHECKS } from "./contentQuality";

/*
 * Versioned deterministic audit-check registry (Engines 3, 4, 8, 9, 10, 11, 12, 13).
 * Each check declares what it needs; a check without adequate evidence returns "unknown", never "fail".
 * Unknown / not_applicable results are excluded from scores (unknown is not zero).
 */

export type CheckCategory = "clarity" | "contact" | "trust" | "services" | "content" | "technical" | "performance";
export type CheckState = "pass" | "warn" | "fail" | "unknown" | "not_applicable";
export type Severity = "critical" | "high" | "medium" | "low";

export interface CheckContext {
  crawl: SiteCrawl;
  evidence: SiteEvidence;
  speed: SpeedResult;
  now: Date;
}

export interface CheckResult {
  id: string;
  category: CheckCategory;
  title: string;
  state: CheckState;
  severity: Severity;
  weight: number;
  explanation: string;
  sources: string[];
  remediation: string;
  rubricVersion: string;
}

export interface CheckDefinition {
  id: string;
  category: CheckCategory;
  title: string;
  description: string;
  severity: Severity;
  /** Relative weight inside its category */
  weight: number;
  requires: string[];
  remediation: string;
  evaluate: (ctx: CheckContext) => { state: CheckState; explanation: string; sources?: string[] };
}

const home = (ctx: CheckContext) => ctx.crawl.pages.find((p) => p.kind === "home" && p.extract)?.extract ?? null;
const readPages = (ctx: CheckContext) => ctx.crawl.pages.filter((p) => p.state === "read" && p.extract);
const unknown = (why: string) => ({ state: "unknown" as const, explanation: why });
const siteRead = (ctx: CheckContext) => ctx.crawl.state === "ok" || ctx.crawl.state === "cancelled";

/** present → pass, absent_confirmed → fail, anything else → unknown (with the evidence basis). */
function featureCheck(key: FeatureKey, label: string) {
  return (ctx: CheckContext) => {
    const f = ctx.evidence.features[key];
    const map: Record<EvidenceState, CheckState> = { present: "pass", absent_confirmed: "fail", not_observed: "unknown", render_failed: "unknown", fetch_failed: "unknown", provider_unavailable: "unknown", not_applicable: "not_applicable" };
    return {
      state: map[f.state],
      explanation: f.state === "present" ? `${label}: found. ${f.evidence[0]?.excerpt ?? ""}`.trim() : `${label}: ${f.state.replace("_", " ")}. ${f.basis}`,
      sources: f.evidence.map((e) => e.url),
    };
  };
}

const withHome = (fn: (h: NonNullable<ReturnType<typeof home>>, ctx: CheckContext) => { state: CheckState; explanation: string; sources?: string[] }) => (ctx: CheckContext) => {
  const h = home(ctx);
  if (!h || !siteRead(ctx)) return unknown("Home page was not read.");
  if (h.looksLikeJsShell && ctx.crawl.pages.find((p) => p.kind === "home")?.method === "static") return unknown("Home page looks JavaScript-rendered; static HTML is not representative.");
  const r = fn(h, ctx);
  return { ...r, sources: r.sources ?? [h.url] };
};

const speedCheck = (pick: (s: NonNullable<SpeedResult["mobile"]>) => number | null, good: number, ok: number, lowerIsBetter: boolean, label: string, unit = "") => (ctx: CheckContext) => {
  if (ctx.speed.state !== "measured" || !ctx.speed.mobile) return unknown(`PageSpeed ${ctx.speed.state.replace("_", " ")}${ctx.speed.error ? `: ${ctx.speed.error}` : ""}.`);
  const v = pick(ctx.speed.mobile);
  if (v === null) return unknown(`${label} not returned by PageSpeed.`);
  const better = (a: number, b: number) => (lowerIsBetter ? a <= b : a >= b);
  const state: CheckState = better(v, good) ? "pass" : better(v, ok) ? "warn" : "fail";
  return { state, explanation: `Mobile ${label} (lab): ${v}${unit}.`, sources: [ctx.speed.requestedUrl ?? ""] };
};

export const CHECKS: CheckDefinition[] = [
  ...CONTENT_QUALITY_CHECKS,
  // ── Service & message clarity ────────────────────────────────────────────────
  { id: "CLR-001", category: "clarity", title: "Home page has a title", description: "A <title> element is present on the home page.", severity: "high", weight: 2, requires: ["home"], remediation: "Add a descriptive page title naming the core service and area.",
    evaluate: withHome((h) => (h.title ? { state: "pass", explanation: `Title: "${h.title}"` } : { state: "fail", explanation: "No <title> on the home page." })) },
  { id: "CLR-002", category: "clarity", title: "Home page has a meta description", description: "Meta description present.", severity: "medium", weight: 1, requires: ["home"], remediation: "Write a 70–170 character description of the service, area and how to get help.",
    evaluate: withHome((h) => (h.metaDescription ? { state: "pass", explanation: `Description: "${h.metaDescription.slice(0, 160)}"` } : { state: "fail", explanation: "No meta description." })) },
  { id: "CLR-003", category: "clarity", title: "Single clear H1 on home page", description: "Exactly one H1.", severity: "medium", weight: 1.5, requires: ["home"], remediation: "Use exactly one H1 that states what the business does.",
    evaluate: withHome((h) => (h.h1Count === 1 ? { state: "pass", explanation: `H1: "${h.headings.find((x) => x.level === 1)?.text ?? ""}"` } : h.h1Count === 0 ? { state: "fail", explanation: "No H1 on the home page." } : { state: "warn", explanation: `${h.h1Count} H1 elements on the home page.` })) },
  { id: "CLR-004", category: "clarity", title: "Home headline names a service", description: "The H1 or title mentions a configured service category.", severity: "medium", weight: 2, requires: ["home"], remediation: "Make the main headline say which service the visitor can get (e.g. funeral / cremation support).",
    evaluate: withHome((h) => {
      const text = `${h.headings.find((x) => x.level === 1)?.text ?? ""} ${h.title ?? ""}`;
      return /funeral|cremation|antim|sanskar|hearse|dead ?body|asthi|repatriation|pandit|ritual|अंतिम|अस्थि|दाह/i.test(text) ? { state: "pass", explanation: `Headline/title mentions a service: "${text.trim().slice(0, 140)}"` } : { state: "fail", explanation: `Headline/title does not name a configured service: "${text.trim().slice(0, 140)}"` };
    }) },
  { id: "CLR-005", category: "clarity", title: "Home page has enough explanatory text", description: "≥150 words pass, 50–149 warn, <50 fail.", severity: "low", weight: 1, requires: ["home"], remediation: "Explain services, coverage and the first steps a family should take.",
    evaluate: withHome((h) => ({ state: h.wordCount >= 150 ? "pass" : h.wordCount >= 50 ? "warn" : "fail", explanation: `${h.wordCount} words of visible text on the home page.` })) },
  { id: "CLR-006", category: "clarity", title: "Dedicated services page", description: "A services / service-detail page was read.", severity: "medium", weight: 1.5, requires: ["crawl"], remediation: "Add a services hub page linking to each service.", evaluate: featureCheck("servicesPage", "Services page") },
  { id: "CLR-007", category: "clarity", title: "Several service categories explained", description: "≥3 configured service categories evidenced pass, 1–2 warn.", severity: "medium", weight: 1.5, requires: ["crawl"], remediation: "Describe each service you offer on its own section or page.",
    evaluate: (ctx) => {
      if (!siteRead(ctx)) return unknown("Site not read.");
      const present = ctx.evidence.services.filter((s) => s.state === "present");
      if (!present.length) return unknown("No configured service category observed in the sampled pages.");
      return { state: present.length >= 3 ? "pass" : "warn", explanation: `Service categories evidenced: ${present.map((s) => s.label).join(", ")}.`, sources: present.flatMap((s) => s.evidence.map((e) => e.url)).slice(0, 5) };
    } },
  { id: "CLR-008", category: "clarity", title: "Service geography stated", description: "At least one city/region is mentioned.", severity: "medium", weight: 1, requires: ["crawl"], remediation: "State clearly which cities/areas you serve.",
    evaluate: (ctx) => (!siteRead(ctx) ? unknown("Site not read.") : ctx.evidence.places.length ? { state: "pass", explanation: `Places mentioned: ${ctx.evidence.places.slice(0, 8).map((p) => p.place).join(", ")}.`, sources: ctx.evidence.places.flatMap((p) => p.evidence.map((e) => e.url)).slice(0, 5) } : unknown("No configured place name observed in the sampled pages.")) },

  // ── Contact / enquiry journey (Engine 11) ───────────────────────────────────
  { id: "CON-001", category: "contact", title: "Phone number published", description: "A phone number is visible.", severity: "critical", weight: 2, requires: ["crawl"], remediation: "Show a phone number prominently on every page.", evaluate: featureCheck("phone", "Phone number") },
  { id: "CON-002", category: "contact", title: "Click-to-call link", description: "A tel: link exists.", severity: "high", weight: 2, requires: ["crawl"], remediation: "Wrap phone numbers in tel: links so mobile visitors can call in one tap.", evaluate: featureCheck("clickToCall", "Click-to-call link") },
  { id: "CON-003", category: "contact", title: "WhatsApp contact link", description: "A wa.me / api.whatsapp.com link exists.", severity: "medium", weight: 1.5, requires: ["crawl"], remediation: "Add a WhatsApp chat link with a short prefilled message.", evaluate: featureCheck("whatsapp", "WhatsApp link") },
  { id: "CON-004", category: "contact", title: "Enquiry form available", description: "A form with ≥2 visible fields exists.", severity: "medium", weight: 1.5, requires: ["crawl"], remediation: "Offer a short enquiry / callback form.", evaluate: featureCheck("contactForm", "Enquiry form") },
  { id: "CON-005", category: "contact", title: "Enquiry form is short", description: "Largest form has ≤5 required fields (only when a form exists).", severity: "low", weight: 1, requires: ["contactForm"], remediation: "Ask only for name, phone and the service needed in urgent situations.",
    evaluate: (ctx) => {
      if (ctx.evidence.features.contactForm.state !== "present") return { state: "not_applicable", explanation: "No form observed." };
      const req = ctx.evidence.metrics.formRequiredMax ?? 0;
      const fields = ctx.evidence.metrics.formFieldMax ?? 0;
      return { state: req <= 5 && fields <= 8 ? "pass" : "warn", explanation: `Largest form: ${fields} fields, ${req} marked required.` };
    } },
  { id: "CON-006", category: "contact", title: "Email address published", description: "Email address visible.", severity: "low", weight: 1, requires: ["crawl"], remediation: "Publish an email address for documents and non-urgent questions.", evaluate: featureCheck("email", "Email") },
  { id: "CON-007", category: "contact", title: "Contact page", description: "A contact page was read.", severity: "medium", weight: 1, requires: ["crawl"], remediation: "Add a contact page with all contact methods and hours.", evaluate: featureCheck("contactPage", "Contact page") },
  { id: "CON-008", category: "contact", title: "Call-to-action on home page", description: "Home page has at least one contact CTA.", severity: "high", weight: 1.5, requires: ["home"], remediation: "Place a clear call / WhatsApp button above the fold.",
    evaluate: withHome((h) => (h.ctas.length ? { state: "pass", explanation: `Home CTAs: ${h.ctas.slice(0, 5).join(" · ")}` } : { state: "fail", explanation: "No contact call-to-action text found on the home page." })) },
  { id: "CON-009", category: "contact", title: "Availability / hours stated", description: "Operating hours or 24×7 claim published.", severity: "medium", weight: 1, requires: ["crawl"], remediation: "State when families can reach you (as a website claim).", evaluate: featureCheck("operatingHours", "Hours / availability claim") },

  // ── Trust & transparency (Engine 12) ────────────────────────────────────────
  { id: "TRU-001", category: "trust", title: "Physical address published", description: "Address visible or in structured data.", severity: "high", weight: 2, requires: ["crawl"], remediation: "Publish the responsible organisation's office address.", evaluate: featureCheck("address", "Address") },
  { id: "TRU-002", category: "trust", title: "Privacy policy", description: "Privacy policy page or link.", severity: "medium", weight: 1.5, requires: ["home"], remediation: "Publish a privacy policy covering enquiry data.", evaluate: featureCheck("privacyPolicy", "Privacy policy") },
  { id: "TRU-003", category: "trust", title: "Terms of service", description: "Terms page or link.", severity: "low", weight: 1, requires: ["home"], remediation: "Publish service terms.", evaluate: featureCheck("termsPolicy", "Terms") },
  { id: "TRU-004", category: "trust", title: "Refund / cancellation policy", description: "Refund or cancellation policy page or link.", severity: "medium", weight: 1.5, requires: ["home"], remediation: "Explain cancellation and refund terms, especially for pre-booking.", evaluate: featureCheck("refundPolicy", "Refund / cancellation policy") },
  { id: "TRU-005", category: "trust", title: "About / organisation page", description: "About page was read.", severity: "medium", weight: 1.5, requires: ["crawl"], remediation: "Explain who runs the service and how.", evaluate: featureCheck("aboutPage", "About page") },
  { id: "TRU-006", category: "trust", title: "Testimonials displayed (site claim)", description: "Testimonial/review section observed. Self-published; not independently verified.", severity: "low", weight: 1, requires: ["crawl"], remediation: "Show consented family feedback; never publish private details.", evaluate: featureCheck("testimonials", "Testimonials (site-published)") },
  { id: "TRU-007", category: "trust", title: "HTTPS", description: "Home page served over HTTPS.", severity: "high", weight: 1.5, requires: ["home"], remediation: "Serve the site over HTTPS with redirects from HTTP.",
    evaluate: (ctx) => (!siteRead(ctx) ? unknown("Site not read.") : { state: ctx.crawl.https ? "pass" : "fail", explanation: ctx.crawl.https ? "Served over HTTPS." : "Home page final URL is not HTTPS.", sources: [ctx.crawl.rootUrl] }) },
  { id: "TRU-008", category: "trust", title: "Organisation structured data", description: "Organization / LocalBusiness (or subtype) JSON-LD.", severity: "low", weight: 1, requires: ["crawl"], remediation: "Add Organization / LocalBusiness JSON-LD with name, address, phone.",
    evaluate: (ctx) => {
      if (!siteRead(ctx)) return unknown("Site not read.");
      const t = ctx.evidence.metrics.schemaTypes;
      return t.some((x) => /Organization|LocalBusiness|FuneralHome|ProfessionalService|Corporation/i.test(x)) ? { state: "pass", explanation: `Schema types: ${t.join(", ")}` } : { state: t.length ? "warn" : "fail", explanation: t.length ? `Schema present but no organisation type: ${t.join(", ")}` : "No JSON-LD found on read pages." };
    } },

  // ── Service / package information (Engines 4, 5, 13) ──────────────────────
  { id: "SRV-001", category: "services", title: "Prices published", description: "At least one quote-verified price claim.", severity: "medium", weight: 2, requires: ["crawl"], remediation: "Publish starting prices or price ranges with what they include.", evaluate: featureCheck("pricing", "Published price") },
  { id: "SRV-002", category: "services", title: "Price qualifiers stated", description: "Published prices state tax treatment or 'starting from' (only when prices exist).", severity: "low", weight: 1, requires: ["pricing"], remediation: "Next to each price, say whether GST is included, the unit and what is included.",
    evaluate: (ctx) => {
      if (!ctx.evidence.prices.length) return { state: "not_applicable", explanation: "No published prices observed." };
      const q = ctx.evidence.prices.filter((p) => p.tax !== "unstated" || p.startingFrom || p.unit);
      return { state: q.length === ctx.evidence.prices.length ? "pass" : q.length ? "warn" : "fail", explanation: `${q.length}/${ctx.evidence.prices.length} price claims state tax, unit or a 'starting from' qualifier.`, sources: [...new Set(ctx.evidence.prices.map((p) => p.sourceUrl))].slice(0, 5) };
    } },
  { id: "SRV-003", category: "services", title: "Packages described", description: "Package/plan descriptions observed.", severity: "medium", weight: 1.5, requires: ["crawl"], remediation: "Describe packages with inclusions and exclusions.", evaluate: featureCheck("packages", "Packages") },
  { id: "SRV-004", category: "services", title: "Individual service pages", description: "≥2 service-detail pages read pass, 1 warn.", severity: "medium", weight: 1.5, requires: ["crawl"], remediation: "Give each major service its own page.",
    evaluate: (ctx) => {
      if (!siteRead(ctx)) return unknown("Site not read.");
      const n = readPages(ctx).filter((p) => p.kind === "service_detail").length;
      if (n === 0) return unknown("No service-detail page among the sampled pages (the site may still have them).");
      return { state: n >= 2 ? "pass" : "warn", explanation: `${n} service-detail page(s) read.`, sources: readPages(ctx).filter((p) => p.kind === "service_detail").map((p) => p.url).slice(0, 5) };
    } },
  { id: "SRV-005", category: "services", title: "Location / service-area pages", description: "A locations page was read.", severity: "low", weight: 1, requires: ["crawl"], remediation: "Add service-area pages for the cities you actually cover.", evaluate: featureCheck("locationPages", "Location pages") },

  // ── Content & helpfulness (Engine 7) ────────────────────────────────────────
  { id: "CNT-001", category: "content", title: "FAQ content", description: "FAQ questions observed.", severity: "medium", weight: 1.5, requires: ["crawl"], remediation: "Answer the questions families ask first (documents, timing, costs).", evaluate: featureCheck("faq", "FAQ") },
  { id: "CNT-002", category: "content", title: "FAQ structured data", description: "FAQPage schema present when FAQs exist.", severity: "low", weight: 0.5, requires: ["faq"], remediation: "Mark up FAQs with FAQPage JSON-LD.",
    evaluate: (ctx) => (ctx.evidence.features.faq.state !== "present" ? { state: "not_applicable", explanation: "No FAQ observed." } : ctx.evidence.metrics.schemaTypes.includes("FAQPage") ? { state: "pass", explanation: "FAQPage schema present." } : { state: "warn", explanation: "FAQs present without FAQPage schema." }) },
  { id: "CNT-003", category: "content", title: "Guides / blog", description: "Blog or resources page read.", severity: "low", weight: 1, requires: ["crawl"], remediation: "Publish helpful guides (process, rituals, documents).", evaluate: featureCheck("blog", "Blog / guides") },
  { id: "CNT-004", category: "content", title: "Hindi-language content", description: "Devanagari text or hi lang observed.", severity: "low", weight: 1, requires: ["crawl"], remediation: "Offer key pages in Hindi.", evaluate: featureCheck("hindiContent", "Hindi content") },
  { id: "CNT-005", category: "content", title: "Content depth in sample", description: "≥1500 words across read pages pass, 600–1499 warn.", severity: "low", weight: 1, requires: ["crawl"], remediation: "Expand service explanations with process and inclusions.",
    evaluate: (ctx) => {
      if (!siteRead(ctx) || ctx.evidence.metrics.pagesRead < 2) return unknown("Too few pages read to judge depth.");
      const w = ctx.evidence.metrics.totalWords;
      return { state: w >= 1500 ? "pass" : w >= 600 ? "warn" : "fail", explanation: `${w} words across ${ctx.evidence.metrics.pagesRead} read pages (sample only).` };
    } },
  { id: "CNT-006", category: "content", title: "Freshness signal", description: "A sitemap lastmod or page date within 365 days.", severity: "low", weight: 0.5, requires: ["dates"], remediation: "Keep key pages and sitemap lastmod dates current.",
    evaluate: (ctx) => {
      const dates = [ctx.crawl.sitemap.latestLastmod, ...readPages(ctx).map((p) => p.extract!.latestDate)].filter((d): d is string => !!d);
      if (!dates.length) return unknown("No publish/modified dates found (absence of dates is not staleness).");
      const sorted = dates.sort();
      const latest = sorted[sorted.length - 1];
      const age = (ctx.now.getTime() - new Date(latest).getTime()) / 86_400_000;
      return { state: age <= 365 ? "pass" : "warn", explanation: `Latest date signal: ${latest}.` };
    } },

  // ── Technical & on-page SEO (Engines 8, 9) ──────────────────────────────────
  { id: "TEC-001", category: "technical", title: "robots.txt readable", description: "robots.txt returned and parsed, or a clean 4xx (no restrictions).", severity: "low", weight: 0.5, requires: ["crawl"], remediation: "Serve a valid robots.txt that references the sitemap.",
    evaluate: (ctx) => (ctx.crawl.robots.status === "parsed" ? { state: "pass", explanation: `robots.txt parsed (${ctx.crawl.robots.rulesCount} rules for our agent group).` } : ctx.crawl.robots.status === "missing" ? { state: "warn", explanation: `No robots.txt (HTTP ${ctx.crawl.robots.httpStatus}).` } : unknown("robots.txt could not be fetched.")) },
  { id: "TEC-002", category: "technical", title: "XML sitemap", description: "A sitemap was found.", severity: "medium", weight: 1, requires: ["crawl"], remediation: "Publish /sitemap.xml and reference it in robots.txt.",
    evaluate: (ctx) => (!siteRead(ctx) ? unknown("Site not read.") : ctx.crawl.sitemap.found ? { state: "pass", explanation: `${ctx.crawl.sitemap.entryCount} sitemap URLs.`, sources: ctx.crawl.sitemap.sources } : { state: "fail", explanation: "No sitemap at robots.txt-declared locations or /sitemap.xml." }) },
  { id: "TEC-003", category: "technical", title: "Canonical on home page", description: "rel=canonical present.", severity: "low", weight: 1, requires: ["home"], remediation: "Add a self-referencing canonical link.",
    evaluate: withHome((h) => (h.canonical ? { state: "pass", explanation: `Canonical: ${h.canonical}` } : { state: "fail", explanation: "No canonical link." })) },
  { id: "TEC-004", category: "technical", title: "Canonicals stay on site", description: "No read page canonicalises to another domain.", severity: "high", weight: 1, requires: ["crawl"], remediation: "Point canonicals to this site's own URLs.",
    evaluate: (ctx) => {
      const withC = readPages(ctx).filter((p) => p.extract!.canonical);
      if (!withC.length) return unknown("No canonicals on read pages.");
      const off = withC.filter((p) => { try { return !sameSite(new URL(p.extract!.canonical!).hostname, new URL(p.finalUrl ?? p.url).hostname); } catch { return true; } });
      return off.length ? { state: "fail", explanation: `${off.length} page(s) canonicalise off-site.`, sources: off.map((p) => p.url) } : { state: "pass", explanation: `${withC.length} canonical(s) on-site.` };
    } },
  { id: "TEC-005", category: "technical", title: "Mobile viewport", description: "meta viewport present on home.", severity: "high", weight: 1, requires: ["home"], remediation: "Add <meta name=viewport content='width=device-width, initial-scale=1'>.",
    evaluate: withHome((h) => (h.viewport ? { state: "pass", explanation: "Viewport meta present." } : { state: "fail", explanation: "No viewport meta." })) },
  { id: "TEC-006", category: "technical", title: "Language declared", description: "<html lang> set.", severity: "low", weight: 0.5, requires: ["home"], remediation: "Set <html lang> (and hreflang for Hindi versions).",
    evaluate: withHome((h) => (h.lang ? { state: "pass", explanation: `lang="${h.lang}"` } : { state: "fail", explanation: "No lang attribute." })) },
  { id: "TEC-007", category: "technical", title: "Open Graph tags", description: "og:title and og:image on home.", severity: "low", weight: 0.5, requires: ["home"], remediation: "Add og:title, og:description and og:image for link previews (WhatsApp shares).",
    evaluate: withHome((h) => (h.og.title && h.og.image ? { state: "pass", explanation: "og:title and og:image present." } : h.og.title || h.og.image ? { state: "warn", explanation: "Open Graph incomplete." } : { state: "fail", explanation: "No Open Graph tags." })) },
  { id: "TEC-008", category: "technical", title: "Image alt text", description: "≥80% of images on read pages have alt text.", severity: "low", weight: 1, requires: ["crawl"], remediation: "Describe meaningful images with alt text.",
    evaluate: (ctx) => {
      const { imagesTotal: t, imagesWithAlt: a } = ctx.evidence.metrics;
      if (!siteRead(ctx)) return unknown("Site not read.");
      if (!t) return { state: "not_applicable", explanation: "No <img> elements on read pages." };
      const r = a / t;
      return { state: r >= 0.8 ? "pass" : r >= 0.5 ? "warn" : "fail", explanation: `${a}/${t} images have alt text (${Math.round(r * 100)}%).` };
    } },
  { id: "TEC-009", category: "technical", title: "Title length", description: "Home title 30–65 characters.", severity: "low", weight: 0.5, requires: ["home"], remediation: "Keep titles roughly 30–65 characters.",
    evaluate: withHome((h) => (!h.title ? { state: "fail", explanation: "No title." } : { state: h.title.length >= 30 && h.title.length <= 65 ? "pass" : "warn", explanation: `Title length ${h.title.length}.` })) },
  { id: "TEC-010", category: "technical", title: "Meta description length", description: "Home description 70–170 characters.", severity: "low", weight: 0.5, requires: ["home"], remediation: "Keep descriptions roughly 70–170 characters.",
    evaluate: withHome((h) => (!h.metaDescription ? { state: "fail", explanation: "No description." } : { state: h.metaDescription.length >= 70 && h.metaDescription.length <= 170 ? "pass" : "warn", explanation: `Description length ${h.metaDescription.length}.` })) },
  { id: "TEC-011", category: "technical", title: "Home page indexable", description: "No noindex robots meta on home.", severity: "critical", weight: 1.5, requires: ["home"], remediation: "Remove noindex from pages that should appear in search.",
    evaluate: withHome((h) => (/noindex/i.test(h.robotsMeta ?? "") ? { state: "fail", explanation: `robots meta: ${h.robotsMeta}` } : { state: "pass", explanation: h.robotsMeta ? `robots meta: ${h.robotsMeta}` : "No robots meta restriction." })) },
  { id: "TEC-012", category: "technical", title: "Sampled pages return 200", description: "No selected internal page returned 4xx/5xx.", severity: "medium", weight: 1, requires: ["crawl"], remediation: "Fix or redirect broken internal URLs.",
    evaluate: (ctx) => {
      if (!siteRead(ctx)) return unknown("Site not read.");
      const bad = ctx.crawl.pages.filter((p) => p.state === "http_error");
      return bad.length ? { state: bad.some((p) => (p.httpStatus ?? 0) >= 500) ? "fail" : "warn", explanation: `${bad.length} sampled page(s) returned an error: ${bad.map((p) => `${p.httpStatus} ${p.url}`).slice(0, 3).join("; ")}`, sources: bad.map((p) => p.url) } : { state: "pass", explanation: "All fetched sampled pages returned 2xx." };
    } },
  { id: "TEC-013", category: "technical", title: "Unique page titles", description: "No duplicate titles among read pages.", severity: "low", weight: 0.5, requires: ["crawl"], remediation: "Give each page its own title.",
    evaluate: (ctx) => {
      const titles = readPages(ctx).map((p) => p.extract!.title).filter((t): t is string => !!t);
      if (titles.length < 2) return unknown("Fewer than two titled pages read.");
      const dup = titles.filter((t, i) => titles.indexOf(t) !== i);
      return dup.length ? { state: "warn", explanation: `Duplicate titles: ${[...new Set(dup)].slice(0, 3).join(" | ")}` } : { state: "pass", explanation: `${titles.length} distinct titles.` };
    } },
  { id: "TEC-014", category: "technical", title: "Structured data parses", description: "No invalid JSON-LD blocks on read pages.", severity: "low", weight: 0.5, requires: ["crawl"], remediation: "Fix JSON syntax errors in JSON-LD blocks.",
    evaluate: (ctx) => {
      const pages = readPages(ctx);
      const valid = pages.reduce((s, p) => s + p.extract!.jsonLd.validBlocks, 0);
      const invalid = pages.reduce((s, p) => s + p.extract!.jsonLd.invalidBlocks, 0);
      if (!valid && !invalid) return { state: "not_applicable", explanation: "No JSON-LD blocks." };
      return invalid ? { state: "fail", explanation: `${invalid} JSON-LD block(s) failed to parse.` } : { state: "pass", explanation: `${valid} JSON-LD block(s) parsed.` };
    } },
  { id: "TEC-015", category: "technical", title: "Short home redirect chain", description: "≤1 redirect hop to the home page.", severity: "low", weight: 0.5, requires: ["home"], remediation: "Redirect directly to the final canonical URL in one hop.",
    evaluate: (ctx) => {
      const h = ctx.crawl.pages.find((p) => p.kind === "home");
      if (!h || h.state !== "read") return unknown("Home page not read.");
      return { state: h.redirectChain.length <= 1 ? "pass" : "warn", explanation: `${h.redirectChain.length} redirect hop(s).` };
    } },
  { id: "TEC-016", category: "technical", title: "Every read page has an H1", description: "All read pages contain an H1.", severity: "low", weight: 0.5, requires: ["crawl"], remediation: "Give every page one H1.",
    evaluate: (ctx) => {
      const pages = readPages(ctx).filter((p) => !p.extract!.looksLikeJsShell);
      if (pages.length < 2) return unknown("Too few statically readable pages.");
      const missing = pages.filter((p) => p.extract!.h1Count === 0);
      return missing.length ? { state: "warn", explanation: `${missing.length}/${pages.length} pages have no H1.`, sources: missing.map((p) => p.url).slice(0, 5) } : { state: "pass", explanation: `All ${pages.length} pages have an H1.` };
    } },

  // ── Mobile performance (Engine 10; PageSpeed lab data) ──────────────────────
  { id: "PRF-001", category: "performance", title: "Mobile Lighthouse performance", description: "≥90 pass, 50–89 warn, <50 fail (lab).", severity: "medium", weight: 2, requires: ["pagespeed"], remediation: "Reduce JS, optimise images and fonts.", evaluate: speedCheck((m) => m.performance, 90, 50, false, "performance score") },
  { id: "PRF-002", category: "performance", title: "Largest Contentful Paint", description: "≤2500ms pass, ≤4000 warn (lab).", severity: "medium", weight: 1, requires: ["pagespeed"], remediation: "Optimise the hero image and server response.", evaluate: speedCheck((m) => m.lcpMs, 2500, 4000, true, "LCP", " ms") },
  { id: "PRF-003", category: "performance", title: "Cumulative Layout Shift", description: "≤0.1 pass, ≤0.25 warn (lab).", severity: "low", weight: 1, requires: ["pagespeed"], remediation: "Reserve space for images and embeds.", evaluate: speedCheck((m) => m.cls, 0.1, 0.25, true, "CLS") },
  { id: "PRF-004", category: "performance", title: "Total Blocking Time", description: "≤200ms pass, ≤600 warn (lab).", severity: "low", weight: 1, requires: ["pagespeed"], remediation: "Split and defer heavy scripts.", evaluate: speedCheck((m) => m.tbtMs, 200, 600, true, "TBT", " ms") },
  { id: "PRF-005", category: "performance", title: "Lighthouse accessibility", description: "≥90 pass, 50–89 warn (lab).", severity: "low", weight: 1, requires: ["pagespeed"], remediation: "Fix contrast, labels and tap targets.", evaluate: speedCheck((m) => m.accessibility, 90, 50, false, "accessibility score") },
];

export type CheckOverrides = Record<string, { enabled?: boolean; weight?: number; severity?: Severity }>;

/** Applies admin per-check overrides (disable / re-weight / re-grade). Logic itself stays in code and versioned. */
export function applyOverrides(registry: CheckDefinition[], overrides: CheckOverrides = {}): CheckDefinition[] {
  return registry.filter((c) => overrides[c.id]?.enabled !== false).map((c) => ({ ...c, weight: overrides[c.id]?.weight ?? c.weight, severity: overrides[c.id]?.severity ?? c.severity }));
}

export function runChecks(ctx: CheckContext, registry: CheckDefinition[] = CHECKS, overrides: CheckOverrides = {}): CheckResult[] {
  return applyOverrides(registry, overrides).map((c) => {
    let r: { state: CheckState; explanation: string; sources?: string[] };
    try {
      r = c.evaluate(ctx);
    } catch (e) {
      r = { state: "unknown", explanation: `Check could not be evaluated: ${(e as Error).message}` };
    }
    return { id: c.id, category: c.category, title: c.title, state: r.state, severity: c.severity, weight: c.weight, explanation: r.explanation.slice(0, 500), sources: [...new Set((r.sources ?? []).filter(Boolean))].slice(0, 5), remediation: c.remediation, rubricVersion: ANALYZER_VERSIONS.checks };
  });
}
