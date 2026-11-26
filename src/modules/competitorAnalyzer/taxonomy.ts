/*
 * Business configuration. The analyzer is written against this interface so another business can be added later
 * with its own service categories and page priorities. Moksha Voyage is the first (and only) configuration.
 * Patterns are matched against URL paths, link labels, headings and visible text, in English, Hindi (Devanagari)
 * and common Hinglish spellings. These are classification aids, NOT evidence of demand or of any competitor's services.
 */

export type PageKind =
  | "home" | "about" | "services" | "pricing" | "contact" | "locations" | "faq" | "testimonials" | "policy" | "blog" | "service_detail" | "other";

export interface ServiceCategory {
  id: string;
  label: string;
  /** Regexes over lower-cased text; a match is a candidate service mention, still needing a cited quote. */
  patterns: RegExp[];
}

export interface BusinessConfig {
  id: string;
  name: string;
  serviceCategories: ServiceCategory[];
  pageKinds: { kind: PageKind; patterns: RegExp[]; priority: number }[];
  /** Place names recognised in page text (cities / regions); admin-editable */
  places: string[];
  keywordSeeds: string[];
}

export const MOKSHA_CONFIG: BusinessConfig = {
  id: "moksha-voyage",
  name: "Moksha Voyage",
  serviceCategories: [
    { id: "funeral_arrangements", label: "Funeral arrangements", patterns: [/\bfuneral (service|arrangement|management|planning|home|director)s?\b/, /antim sanskar|antim-sanskar|अंतिम संस्कार|अन्तिम संस्कार/] },
    { id: "cremation", label: "Cremation support", patterns: [/\bcremation\b/, /\bcrematorium\b/, /dah sanskar|दाह संस्कार|शवदाह/, /electric (crematorium|cremation)/] },
    { id: "body_transport", label: "Dead body transport / hearse", patterns: [/\b(dead ?body|mortal remains?|deceased) (transport|transportation|shifting|carrier)\b/, /\bhearse\b/, /\b(mortuary|dead ?body) (van|ambulance)\b/, /शव वाहन|शव वाहिनी/] },
    { id: "freezer_preservation", label: "Freezer box / body preservation", patterns: [/\b(freezer|ice) box\b/, /\bbody (preservation|freezer)\b/, /\bembalming\b/, /\bmortuary\b/] },
    { id: "rituals", label: "Rituals and pandit services", patterns: [/\bpandit\b/, /\b(funeral|last) rites?\b/, /\bshraddh|shradh|श्राद्ध/, /\btehrvi|terahvi|तेरहवीं/, /\bpind ?daan|पिंडदान|पिंड दान/, /\bpuja\b|पूजा/] },
    { id: "asthi_visarjan", label: "Asthi visarjan", patterns: [/\basthi\b|अस्थि/, /\bashes? immersion\b/, /\bimmersion of ashes\b/] },
    { id: "repatriation", label: "Domestic / international repatriation", patterns: [/\brepatriation\b/, /\b(international|overseas|abroad) (body|deceased|mortal) (transport|shifting)\b/, /\bair (cargo|ambulance)\b.*\b(body|deceased|remains)\b/, /\bnri\b/] },
    { id: "preplanning", label: "Pre-planning / pre-booking", patterns: [/\bpre-?(planning|plan|booking|book|need|paid)\b/, /\bfuneral plan\b/, /\badvance (booking|planning)\b/] },
    { id: "documentation", label: "Documentation guidance", patterns: [/\bdeath certificate\b/, /\bnoc\b/, /\bdocumentation\b/, /\bembassy\b/, /मृत्यु प्रमाण/] },
    { id: "samagri", label: "Funeral samagri / materials", patterns: [/\bsamagri\b|सामग्री/, /\bfuneral (kit|items|materials)\b/] },
  ],
  pageKinds: [
    { kind: "contact", priority: 95, patterns: [/contact|reach-us|get-in-touch|सम्पर्क|संपर्क/] },
    { kind: "services", priority: 92, patterns: [/^\/?(services?|our-services|what-we-do|सेवाएं|सेवा)(\/|$)/] },
    { kind: "pricing", priority: 90, patterns: [/pric|package|plans?(\/|$)|cost|rate|charges|tariff|पैकेज|शुल्क/] },
    { kind: "service_detail", priority: 85, patterns: [/cremation|funeral|antim|sanskar|hearse|dead-?body|mortal|freezer|asthi|visarjan|pind|shradh|pandit|repatriation|pre-?(plan|book)|samagri|ritual/] },
    { kind: "about", priority: 80, patterns: [/about|who-we-are|our-story|company|हमारे बारे/] },
    { kind: "locations", priority: 75, patterns: [/location|cities|city|service-areas?|branches|areas-we-serve|delhi|noida|gurgaon|gurugram|ghaziabad|faridabad/] },
    { kind: "faq", priority: 70, patterns: [/faq|questions|help|सवाल/] },
    { kind: "testimonials", priority: 60, patterns: [/testimonial|review|feedback|stories/] },
    { kind: "policy", priority: 50, patterns: [/privacy|terms|refund|cancellation|policy|disclaimer|grievance|complaint|redressal/] },
    { kind: "blog", priority: 40, patterns: [/blog|news|article|resources|guide|insights/] },
  ],
  places: [
    "Delhi", "New Delhi", "Delhi NCR", "Noida", "Greater Noida", "Ghaziabad", "Gurgaon", "Gurugram", "Faridabad", "Meerut",
    "Mumbai", "Pune", "Bangalore", "Bengaluru", "Hyderabad", "Chennai", "Kolkata", "Lucknow", "Jaipur", "Chandigarh",
    "Ahmedabad", "Varanasi", "Haridwar", "Rishikesh", "Prayagraj", "Allahabad", "Gaya", "Patna", "Dehradun", "Agra",
    "Kanpur", "Indore", "Bhopal", "Surat", "Nagpur", "Mathura", "Vrindavan", "Ayodhya", "Garhmukteshwar",
    "दिल्ली", "नोएडा", "गाजियाबाद", "गुरुग्राम", "फरीदाबाद", "हरिद्वार", "वाराणसी",
  ],
  keywordSeeds: [
    "funeral services in Delhi",
    "cremation services Ghaziabad",
    "dead body transportation Noida",
    "antim sanskar services Delhi NCR",
    "asthi visarjan services India",
    "international deceased repatriation India",
    "funeral preplanning services",
  ],
};

const { AsyncLocalStorage } = require("node:async_hooks") as typeof import("node:async_hooks");
const businessContext = new AsyncLocalStorage<BusinessConfig>();
let active: BusinessConfig = MOKSHA_CONFIG;

/** Every asynchronous operation in a run uses the same compiled settings, even after an admin saves new ones. */
export function withBusinessConfig<T>(config: BusinessConfig, fn: () => T): T {
  return businessContext.run(config, fn);
}

/** The configuration in use (admin settings when loaded, else the code default). */
export function activeBusinessConfig(): BusinessConfig {
  return businessContext.getStore() ?? active;
}

/** Called by settings.loadActiveSettings(); tests may reset with MOKSHA_CONFIG. */
export function setActiveBusinessConfig(cfg: BusinessConfig) {
  active = cfg;
}

/** Service categories whose patterns match `text` (lower-cased). */
export function matchServiceCategories(text: string, config: BusinessConfig = activeBusinessConfig()): string[] {
  const t = text.toLowerCase();
  return config.serviceCategories.filter((c) => c.patterns.some((p) => p.test(t))).map((c) => c.id);
}
