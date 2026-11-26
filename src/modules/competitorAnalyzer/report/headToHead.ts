import { SourceSet, validateComparison } from "../ai/validate";

/** Comparisons of observed public website evidence, never claims about the businesses themselves. */
interface Fact { state: string; evidence?: { url: string; excerpt: string; quote?: string }[] }
interface Site {
  domain: string;
  role: string;
  crawlState: string;
  services?: (Fact & { category: string; label: string })[];
  features?: Record<string, Fact>;
}
export interface MeasuredHeadToHead {
  competitor: string;
  source: "measured";
  ownLeads: { text: string; evidence: { url: string; quote: string }[] }[];
  competitorLeads: { text: string; evidence: { url: string; quote: string }[] }[];
  verdict: string;
}
const LABELS: Record<string, string> = {
  phone: "phone contact", clickToCall: "tap-to-call", whatsapp: "WhatsApp contact", contactForm: "an enquiry form",
  email: "email contact", address: "an office address", operatingHours: "availability information",
  pricing: "published prices", packages: "package information", faq: "FAQ content", testimonials: "testimonials on the website",
  blog: "guides or articles", aboutPage: "an about page", servicesPage: "a services page", contactPage: "a contact page",
  privacyPolicy: "a privacy policy", termsPolicy: "terms", refundPolicy: "a refund policy", locationPages: "location pages",
  structuredData: "structured data", hindiContent: "Hindi content", socialLinks: "social profile links",
};
const quoteOf = (e: { quote?: string; excerpt: string }, service?: boolean) => (e.quote ?? (service ? e.excerpt : "")).replace(/^(?:…|â€¦)|(?:…|â€¦)$/g, "").trim();
function observedLeads(a: Site, b: Site) {
  const facts: { label: string; a: Fact; b?: Fact; literalService?: boolean }[] = [
    ...(a.services ?? []).map((s) => ({ label: s.label, a: s, b: b.services?.find((x) => x.category === s.category), literalService: true })),
    ...Object.entries(a.features ?? {}).filter(([key]) => LABELS[key]).map(([key, fact]) => ({ label: LABELS[key], a: fact, b: b.features?.[key] })),
  ];
  return facts.filter((f) => f.a.state === "present" && ["not_observed", "absent_confirmed"].includes(f.b?.state ?? ""))
    .flatMap((f) => {
      const cite = f.a.evidence?.find((e) => e.url && quoteOf(e, f.literalService).length >= 5);
      return cite ? [{ text: `${a.domain} provides website evidence of ${f.label}; this was not observed in the sampled pages of ${b.domain}. This describes the pages read, not whether the other business offers it.`, evidence: [{ url: cite.url, quote: quoteOf(cite, f.literalService) }] }] : [];
    }).slice(0, 4);
}
export function measuredHeadToHead(sites: Site[]): MeasuredHeadToHead[] {
  const own = sites.find((s) => s.role === "own");
  if (!own) return [];
  return sites.filter((s) => s.role === "competitor").map((c) => {
    const readable = own.crawlState === "ok" && c.crawlState === "ok";
    const ownLeads = readable ? observedLeads(own, c) : [];
    const competitorLeads = readable ? observedLeads(c, own) : [];
    return { competitor: c.domain, source: "measured", ownLeads, competitorLeads,
      verdict: !readable ? "A website could not be read; no reliable head-to-head conclusion is available."
        : ownLeads.length || competitorLeads.length ? "These differences are backed by saved public-page excerpts. Not observed in a bounded sample does not mean absent from the business."
          : "No supported difference was found in the saved service and feature evidence. Similar scores alone do not prove either business is better." };
  });
}
/** Also gives existing reports with failed AI an evidence comparison without changing their saved data. */
export function withMeasuredComparison<T extends Record<string, any>>(report: T): T & { measuredHeadToHead: MeasuredHeadToHead[] } {
  let ai = report.ai;
  if (ai?.result && !ai.grounding?.startsWith("extractive")) {
    // Older reports already saved validated citations. Re-project their wording from those saved excerpts,
    // without refetching pages, changing historical scores or spending another AI call.
    const sourceText = new Map<string, string>();
    const collect = (value: any): void => {
      if (Array.isArray(value)) { value.forEach(collect); return; }
      if (!value || typeof value !== "object") return;
      if (typeof value.url === "string" && typeof value.quote === "string") sourceText.set(value.url, `${sourceText.get(value.url) ?? ""}\n${value.quote}`);
      Object.values(value).forEach(collect);
    };
    collect(ai.result);
    const own = report.sites?.find((s: any) => s.role === "own")?.domain ?? report.scope?.own;
    if (own) {
      const v = validateComparison(ai.result, new SourceSet(sourceText), { own, competitors: (report.sites ?? []).filter((s: any) => s.role === "competitor").map((s: any) => s.domain) });
      ai = { ...ai, result: v.result, grounding: "extractive-saved-v1", dropped: (ai.dropped ?? 0) + v.dropped.length };
    }
  }
  return { ...report, ...(ai ? { ai } : {}), measuredHeadToHead: report.measuredHeadToHead ?? measuredHeadToHead(report.sites ?? []) };
}
