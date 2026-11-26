import { normalizePageUrl } from "../crawler/url";
import { sameSite } from "../crawler/url";

/*
 * Server-side validation of AI output. Nothing the model says is accepted unless it can be tied to the evidence:
 *  - every cited URL must be in the accepted source set (pages actually read in this run)
 *  - every quote must occur verbatim (whitespace/case-normalised) in that page's text
 *  - any number written in a claim that looks like a price must appear in one of its verified quotes
 *  - a claim/recommendation left with zero valid citations is dropped, and the drop is recorded
 */

export interface Cite {
  url: string;
  quote: string;
}
export interface Dropped {
  path: string;
  reason: string;
}

const norm = (s: string) => s.toLowerCase().replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/\s+/g, " ").trim();

export class SourceSet {
  private pages = new Map<string, string>();
  constructor(sources: Map<string, string>) {
    for (const [url, text] of sources) {
      const key = normalizePageUrl(url);
      if (key) this.pages.set(key, norm(text));
    }
  }
  has(url: string) {
    const key = normalizePageUrl(url);
    return !!key && this.pages.has(key);
  }
  quoteOk(url: string, quote: string) {
    const key = normalizePageUrl(url);
    const q = norm(quote);
    if (!key || q.length < 5 || q.length > 300) return false;
    return this.pages.get(key)?.includes(q.replace(/^…|…$/g, "").trim()) ?? false;
  }
  canonical(url: string) {
    return normalizePageUrl(url) ?? url;
  }
}

/** Keeps only citations whose URL is accepted and whose quote is verbatim on that page. */
export function verifyCites(cites: unknown, sources: SourceSet, path: string, dropped: Dropped[]): Cite[] {
  if (!Array.isArray(cites)) return [];
  const out: Cite[] = [];
  cites.forEach((c, i) => {
    const url = typeof c?.url === "string" ? c.url : "";
    const quote = typeof c?.quote === "string" ? c.quote : "";
    if (!sources.has(url)) dropped.push({ path: `${path}[${i}]`, reason: `Cited URL not in accepted source set: ${url.slice(0, 120)}` });
    else if (!sources.quoteOk(url, quote)) dropped.push({ path: `${path}[${i}]`, reason: `Quote not found verbatim on ${url.slice(0, 120)}` });
    else out.push({ url: sources.canonical(url), quote: quote.slice(0, 300) });
  });
  return out.slice(0, 5);
}

const PRICE_IN_TEXT = /(?:₹|rs\.?|inr)\s?(\d[\d,]*)/gi;
/** Every price-like number in `text` must appear in at least one verified quote. */
export function pricesSupported(text: string, cites: Cite[]): boolean {
  const quotes = cites.map((c) => c.quote.replace(/,/g, "")).join(" ");
  for (const m of text.matchAll(PRICE_IN_TEXT)) if (!quotes.includes(m[1].replace(/,/g, ""))) return false;
  return true;
}

/** All narrative surfaces use the same unsupported-metrics policy, including nested outlines and audience. */
export const unsupportedMetric = (text: string) => /\b(market share|search volume|monthly (?:search )?volume|keyword difficulty|cpc|cost per click|revenue|business threat|(?:monthly|organic|website|estimated|daily) traffic|visitors per (?:month|day)|traffic of)\b|\b(?:rank(?:ed|s|ing)?|position)\s*(?:at\s*|is\s*|of\s*|[:#]\s*|no\.?\s*|number\s*)?\d|\b\d[\d,.]*\s*(?:monthly visitors|visitors|visits|clicks|impressions|backlinks|reviews|stars)\b/i.test(text);

function hasUnsupportedMetric(value: unknown): boolean {
  if (typeof value === "string") return unsupportedMetric(value);
  if (Array.isArray(value)) return value.some(hasUnsupportedMetric);
  return !!value && typeof value === "object" && Object.values(value).some(hasUnsupportedMetric);
}

function claimList(list: unknown, sources: SourceSet, path: string, dropped: Dropped[], max = 8, domain?: string) {
  if (!Array.isArray(list)) return [];
  const out: { text: string; evidence: Cite[] }[] = [];
  list.slice(0, max).forEach((c, i) => {
    const text = typeof c?.text === "string" ? c.text.slice(0, 600) : "";
    const evidence = verifyCites(c?.evidence, sources, `${path}[${i}].evidence`, dropped);
    if (hasUnsupportedMetric(c)) dropped.push({ path: `${path}[${i}]`, reason: "Contains an unsupported metric claim (ranking/volume/traffic/revenue/threat)" });
    else if (!text || !evidence.length) dropped.push({ path: `${path}[${i}]`, reason: "Claim has no verifiable evidence" });
    else if (!pricesSupported(text, evidence)) dropped.push({ path: `${path}[${i}]`, reason: "Claim states a price that its quotes do not contain" });
    else {
      // Literal occurrence does not prove a paraphrase. Publish independent, extractive observations instead.
      // In particular a Ghaziabad office quote cannot become a London repatriation claim.
      const local = evidence.filter((e) => !domain || sameSite(new URL(e.url).hostname, domain));
      if (!local.length) dropped.push({ path: `${path}[${i}]`, reason: "Evidence belongs to a different website" });
      for (const e of local.slice(0, 3)) {
        if (!out.some((x) => norm(x.text) === norm(e.quote))) out.push({ text: e.quote, evidence: [e] });
      }
    }
  });
  return out.slice(0, max);
}

export interface ValidatedComparison {
  summary: string | null;
  sites: { domain: string; positioning: { text: string; evidence: Cite[] } | null; audience: string; strengths: { text: string; evidence: Cite[] }[]; weaknesses: { text: string; evidence: Cite[] }[] }[];
  headToHead: { competitor: string; ownLeads: { text: string; evidence: Cite[] }[]; competitorLeads: { text: string; evidence: Cite[] }[]; verdict: string }[];
  gaps: { title: string; detail: string; category: string; evidence: Cite[] }[];
  recommendations: { title: string; problem: string; recommendation: string; priority: "high" | "medium" | "low"; effort: "S" | "M" | "L"; impactRationale: string; horizonDays: 30 | 60 | 90; category: string; evidence: Cite[] }[];
  contentIdeas: { title: string; format: string; reason: string; outline: string[]; evidence: Cite[] }[];
  faqDrafts: { question: string; answerDraft: string; evidence: Cite[] }[];
}

export function validateComparison(data: any, sources: SourceSet, domains: { own: string; competitors: string[] }): { result: ValidatedComparison; dropped: Dropped[] } {
  const dropped: Dropped[] = [];
  const known = new Set([domains.own, ...domains.competitors]);
  const s = (v: unknown, n = 1_000) => (typeof v === "string" ? v.slice(0, n) : "");
  const bannedCheck = (text: string, path: string) => {
    if (unsupportedMetric(text)) {
      dropped.push({ path, reason: "Contains an unsupported metric claim (ranking/volume/traffic/revenue/threat)" });
      return false;
    }
    return true;
  };
  const sites = (Array.isArray(data?.sites) ? data.sites : [])
    .filter((x: any, i: number) => {
      const ok = known.has(String(x?.domain ?? "").toLowerCase());
      if (!ok) dropped.push({ path: `sites[${i}]`, reason: `Unknown domain ${String(x?.domain).slice(0, 80)}` });
      return ok;
    })
    .map((x: any, i: number) => {
      const domain = String(x.domain).toLowerCase();
      const pos = claimList([x.positioning], sources, `sites[${i}].positioning`, dropped, 1, domain)[0] ?? null;
      bannedCheck(s(x.audience, 300), `sites[${i}].audience`);
      return { domain, positioning: pos, audience: "", strengths: claimList(x.strengths, sources, `sites[${i}].strengths`, dropped, 6, domain), weaknesses: claimList(x.weaknesses, sources, `sites[${i}].weaknesses`, dropped, 6, domain) };
    });
  const headToHead = (Array.isArray(data?.headToHead) ? data.headToHead : [])
    .filter((h: any, i: number) => {
      const ok = domains.competitors.includes(String(h?.competitor ?? "").toLowerCase());
      if (!ok) dropped.push({ path: `headToHead[${i}]`, reason: "Unknown competitor domain" });
      return ok;
    })
    .map((h: any, i: number) => ({
      competitor: String(h.competitor).toLowerCase(),
      ownLeads: claimList(h.ownLeads, sources, `headToHead[${i}].ownLeads`, dropped, 8, domains.own),
      competitorLeads: claimList(h.competitorLeads, sources, `headToHead[${i}].competitorLeads`, dropped, 8, String(h.competitor).toLowerCase()),
      verdict: bannedCheck(s(h.verdict, 600), `headToHead[${i}].verdict`) ? "Compare the quoted website statements on each side. A statement on one website does not establish its absence from the other business." : "",
    }));
  const withEvidence = <T extends { evidence: Cite[] }>(list: unknown, path: string, map: (x: any) => Omit<T, "evidence">, max: number, textOf: (x: any) => string): T[] => {
    if (!Array.isArray(list)) return [];
    const out: T[] = [];
    list.slice(0, max).forEach((x, i) => {
      const evidence = verifyCites(x?.evidence, sources, `${path}[${i}].evidence`, dropped);
      const text = textOf(x);
      if (!evidence.length) dropped.push({ path: `${path}[${i}]`, reason: "No verifiable evidence" });
      else if (hasUnsupportedMetric(x)) { dropped.push({ path: `${path}[${i}]`, reason: "Contains an unsupported metric claim (ranking/volume/traffic/revenue/threat)" }); return; }
      else if (!pricesSupported(text, evidence)) dropped.push({ path: `${path}[${i}]`, reason: "States a price its quotes do not contain" });
      else out.push({ ...(map(x) as object), evidence } as T);
    });
    return out;
  };
  const cats = ["clarity", "contact", "trust", "services", "content", "technical", "performance"];
  const gaps = withEvidence<ValidatedComparison["gaps"][number]>(data?.gaps, "gaps", (x) => ({ title: s(x.title, 200), detail: s(x.detail, 800), category: cats.includes(x.category) ? x.category : "content" }), 8, (x) => `${x?.title} ${x?.detail}`);
  const recommendations = withEvidence<ValidatedComparison["recommendations"][number]>(
    data?.recommendations,
    "recommendations",
    (x) => ({
      title: s(x.title, 200), problem: s(x.problem, 800), recommendation: s(x.recommendation, 1200),
      priority: ["high", "medium", "low"].includes(x.priority) ? x.priority : "medium",
      effort: ["S", "M", "L"].includes(x.effort) ? x.effort : "M",
      impactRationale: s(x.impactRationale, 600),
      horizonDays: [30, 60, 90].includes(x.horizonDays) ? x.horizonDays : 60,
      category: cats.includes(x.category) ? x.category : "content",
    }),
    10,
    (x) => `${x?.title} ${x?.problem} ${x?.recommendation} ${x?.impactRationale}`,
  );
  const contentIdeas = withEvidence<ValidatedComparison["contentIdeas"][number]>(data?.contentIdeas, "contentIdeas", (x) => ({ title: s(x.title, 200), format: s(x.format, 20), reason: s(x.reason, 600), outline: Array.isArray(x.outline) ? x.outline.slice(0, 12).map((o: unknown) => s(o, 200)) : [] }), 6, (x) => `${x?.title} ${x?.reason}`);
  const faqDrafts = withEvidence<ValidatedComparison["faqDrafts"][number]>(data?.faqDrafts, "faqDrafts", (x) => ({ question: s(x.question, 300), answerDraft: s(x.answerDraft, 1200) }), 6, (x) => `${x?.question} ${x?.answerDraft}`);
  // Advice remains reviewable AI suggestions. Factual descriptions are always extracted from their proof.
  for (const gap of gaps) gap.detail = gap.evidence.map((e) => e.quote).join(" / ");
  for (const rec of recommendations) rec.problem = rec.evidence.map((e) => e.quote).join(" / ");
  for (const idea of contentIdeas) idea.reason = idea.evidence.map((e) => e.quote).join(" / ");
  const summary = s(data?.summary, 2_000);
  return {
    result: { summary: summary && bannedCheck(summary, "summary") ? "Comparison of sampled public website content. Factual findings use verified page excerpts; recommendations and drafts require review before use." : null, sites, headToHead, gaps, recommendations, contentIdeas, faqDrafts },
    dropped,
  };
}
