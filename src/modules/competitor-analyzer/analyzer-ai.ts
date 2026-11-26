/**
 * Competitor Analyzer AI. Two calls run in parallel on the same evidence:
 *  - "compare": overview, scores per area, head-to-head with a threat level, gaps, opportunities and a timed action plan;
 *  - "profiles": each site up close (promise, tone, strengths, weak spots), the client's SWOT, a topic map and content ideas.
 * Strict validators keep only points that cite a page read for the right site and drop claims pages cannot support.
 */

import type { SiteDigest } from '../website-intelligence/competitor-ai';
import type { SiteEvidence } from './analyzer-evidence';

export const ANALYZER_PROMPT_VERSION = 'cmpz-2026-10-23.1';
export const AREAS = ['Message clarity', 'Trust & proof', 'Calls to action', 'Content depth', 'Ease of contact', 'Search basics', 'Speed & mobile'] as const;
export type Area = (typeof AREAS)[number];
const WHEN = ['this week', 'this month', 'this quarter'] as const;

export interface CitedPoint { point: string; evidence: string; url: string }

export interface CompareResult {
  overview: string;
  scores: { area: Area; scores: Record<string, number>; leader: string | null; note: string }[];
  overall: Record<string, number>;
  headToHead: { competitor: string; threat: 'high' | 'medium' | 'low'; threatReason: string; theyLead: { point: string; url: string }[]; youLead: { point: string; url: string }[]; verdict: string }[];
  gaps: { topic: string; competitors: string[]; why: string; url: string }[];
  opportunities: string[];
  actions: { priority: 'high' | 'medium' | 'low'; action: string; reason: string; effort: 'low' | 'medium' | 'high'; impact: 'high' | 'medium' | 'low'; when: (typeof WHEN)[number]; learnFrom: string | null; evidenceUrls?: string[] }[];
}

export interface ProfilesResult {
  sites: { domain: string; summary: string; audience: string; positioning: string; promise: string; tone: string; offerings: string[]; strengths: CitedPoint[]; weaknesses: CitedPoint[] }[];
  swot: { strengths: string[]; weaknesses: string[]; opportunities: string[]; threats: string[] };
  topics: { topic: string; sites: string[] }[];
  /** outline and keywords are filled from 2026-10-23 on; older runs have only title and why. */
  contentIdeas: { title: string; format: 'page' | 'blog' | 'faq' | 'video' | 'guide'; why: string; inspiredBy: string | null; outline?: string[]; keywords?: string[] }[];
}

export type AnalyzerResult = CompareResult & ProfilesResult;

const RULES = `Use ONLY the page evidence and measurements provided. No outside knowledge about any organisation, and never guess numbers.
Never claim anything about traffic, search rankings, backlinks, revenue, sales, donations raised or follower counts: the evidence does not contain them.
Every cited URL must be copied exactly from the evidence of the site it is about.
Write plain, specific English a business owner understands. Prefer concrete observations over generic advice.
Address the client as "you" / "your site" and name competitors by their domain. Never write the words CLIENT or COMPETITOR in your answer.
Be brief: a point, action, idea or topic is one short sentence (max 14 words); evidence, why, reason and note are max 20 words.`;

const COMPARE_SYSTEM = `You are a senior digital marketing and SEO strategist comparing websites for the CLIENT (always the first site) against its competitors.
${RULES}
Return only a JSON object with exactly these keys:
{
  "overview": "max 3 sentences: the competitive picture and where the client stands",
  "headToHead": [{"competitor": "<competitor domain>", "threat": "high|medium|low", "threatReason": "why this competitor matters to the client", "theyLead": [{"point": "...", "url": "competitor page"}], "youLead": [{"point": "...", "url": "client page"}], "verdict": "one sentence"}],
  "gaps": [{"topic": "what competitors cover that the client does not", "competitors": ["<domain>"], "why": "...", "url": "competitor page"}],
  "opportunities": ["something none of the sites does well, max 5"],
  "actions": [{"priority": "high|medium|low", "action": "what the client should do", "reason": "based on which evidence", "effort": "low|medium|high", "impact": "high|medium|low", "when": "this week|this month|this quarter", "learnFrom": "<competitor domain> or null", "evidenceUrls": ["one or more exact page URLs supporting this action"]}]
}
Rules: do not invent numeric scores; the server calculates them from measurements. Include one headToHead entry per competitor with max 4 points per side; gaps max 10; actions 6 to 12, most important first, spread over the three time frames.`;

const PROFILES_SYSTEM = `You are a brand and content strategist describing each website and planning content for the CLIENT (always the first site).
${RULES}
Return only a JSON object with exactly these keys:
{
  "sites": [{"domain": "...", "summary": "max 2 sentences: who they are, what they offer, to whom", "audience": "...", "positioning": "one sentence", "promise": "the main promise the home page makes, in their words where possible", "tone": "2-4 words, e.g. formal, warm, salesy", "offerings": ["max 6"], "strengths": [{"point": "...", "evidence": "...", "url": "page of this site"}], "weaknesses": [{"point": "...", "evidence": "...", "url": "page of this site"}]}],
  "swot": {"strengths": ["client strengths vs competitors, max 5"], "weaknesses": ["max 5"], "opportunities": ["max 5"], "threats": ["what competitors do that could take the client's audience, max 5"]},
  "topics": [{"topic": "a theme the pages cover, 1-4 words", "sites": ["<every domain whose pages cover it>"]}],
  "contentIdeas": [{"title": "a page or post title the client could publish", "format": "page|blog|faq|video|guide", "why": "the gap or demand it answers", "inspiredBy": "<competitor domain> or null", "outline": ["3 to 6 section headings, in order, for this piece"], "keywords": ["3 to 6 short phrases a customer might type into Google to find this piece, lower case"]}]
}
Rules: one "sites" entry per site; strengths and weaknesses max 4 each; topics 8 to 16, including topics only one site covers; contentIdeas 5 to 8. Outlines and keywords must fit the client's own business as the pages show it; never invent prices, dates or numbers in them.`;

function pageBlock(p: SiteDigest['pages'][number], index = 0): string {
  return [
    `URL: ${p.url}`,
    `Title: ${p.title || '(none)'}`,
    `Meta description: ${p.description || '(none)'}`,
    `Headings: ${p.headings.slice(0, 15).join(' | ') || '(none)'}`,
    `Calls to action: ${p.ctas.join(' | ') || '(none)'}`,
    `Text excerpt: ${p.text.slice(0, index < 6 ? 1100 : 600) || '(none)'}`,
  ].join('\n');
}

function measuredBlock(e: SiteEvidence): string {
  const m = e.metrics;
  const t = e.tech;
  const speed = e.speed ? `mobile performance ${e.speed.performance ?? 'n/a'}/100, SEO ${e.speed.seo ?? 'n/a'}/100, accessibility ${e.speed.accessibility ?? 'n/a'}/100, largest paint ${e.speed.lcpMs != null ? `${(e.speed.lcpMs / 1000).toFixed(1)}s` : 'n/a'}` : 'not measured';
  return [
    `Measured: pages read ${m.pages}, visible words ${m.words}, headings ${m.headings}, different calls to action ${m.ctas}, images ${m.images}`,
    `Contact options: phone ${m.contact.phone ? 'yes' : 'no'}, email ${m.contact.email ? 'yes' : 'no'}, WhatsApp ${m.contact.whatsapp ? 'yes' : 'no'}, form ${m.contact.form ? 'yes' : 'no'}`,
    `Social profiles: ${m.social.join(', ') || '(none)'}; structured data: ${m.schemaTypes.join(', ') || '(none)'}`,
    t ? `Technical: sitemap ${t.sitemapUrls ?? 'not found'} URLs, robots.txt ${t.robotsTxt ? 'yes' : 'no'}, home H1 count ${t.h1Count}, images with alt ${t.imagesWithAlt}/${t.imagesTotal}, canonical ${t.canonical ? 'yes' : 'no'}, Open Graph ${t.openGraph ? 'yes' : 'no'}, blog/news section ${t.hasBlog ? 'yes' : 'no'}, newest dated content ${t.latestDate ?? 'none found'}, sitemap pages updated in the last 30 / 90 days ${t.sitemapRecent30 ?? 'unknown'} / ${t.sitemapRecent90 ?? 'unknown'} (latest ${t.sitemapLatest ?? 'unknown'})` : 'Technical: not measured',
    `Google PageSpeed (home, mobile): ${speed}`,
    ...(e.search ? [`Google Search Console for this site (last 28 days, real data): ${e.search.totals.clicks} clicks, ${e.search.totals.impressions} impressions, average position ${e.search.totals.position}. Top searches: ${e.search.queries.slice(0, 15).map((q) => `"${q.query}" (${q.impressions} impressions, position ${q.position})`).join('; ')}`] : []),
    `Google Knowledge Graph: ${e.brand ? (e.brand.status === 'matched' ? 'Google knows this brand' : e.brand.status === 'possible' ? 'a similar name is known' : e.brand.status === 'not_found' ? 'not known as a brand' : 'not checked') : 'not checked'}`,
  ].join('\n');
}

export function buildEvidence(sites: { evidence: SiteEvidence; digest: SiteDigest }[]): string {
  return sites
    .map(({ evidence, digest }, i) =>
      [`=== ${i === 0 ? 'CLIENT' : `COMPETITOR ${i}`} website: ${evidence.domain} (${digest.pages.length} page(s)) ===`, measuredBlock(evidence), ...digest.pages.map((p, n) => `--- page ${n + 1} ---\n${pageBlock(p, n)}`)].join('\n'),
    )
    .join('\n\n');
}

export function buildAnalyzerPrompts(sites: { evidence: SiteEvidence; digest: SiteDigest }[]) {
  const user = buildEvidence(sites);
  return { compare: { system: COMPARE_SYSTEM, user }, profiles: { system: PROFILES_SYSTEM, user } };
}

/* ------------------------------------------------------------------ */
/* Validation                                                          */
/* ------------------------------------------------------------------ */

const str = (v: unknown, max: number) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, max) : '');
/** Domains are compared without scheme, "www." and path. */
const dom = (v: unknown) => str(v, 200).toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/.*$/, '');
const strList = (v: unknown, maxItems: number, maxLen = 160) => (Array.isArray(v) ? [...new Set(v.map((x) => str(x, maxLen)).filter(Boolean))].slice(0, maxItems) : []);
const oneOf = <T extends string>(v: unknown, allowed: readonly T[], fallback: T): T => (allowed.includes(v as T) ? (v as T) : fallback);
const FORBIDDEN = /\b(traffic|visitors per|monthly visits|backlinks?|domain authority|ranks? (#|number|first|1st)|revenue|turnover|followers|sales figures?)\b/i;

export interface ValidationInput { own: string; competitors: string[]; pages: Record<string, string[]> }
type Checked<T> = { ok: true; result: T; dropped: number } | { ok: false; reason: string };

function parse(text: string): any {
  try {
    const raw = JSON.parse(text);
    return raw && typeof raw === 'object' ? raw : null;
  } catch {
    return null;
  }
}

function citer(counter: { dropped: number }) {
  return (value: unknown, allowed: Set<string>, max: number): CitedPoint[] => {
    const out: CitedPoint[] = [];
    for (const item of Array.isArray(value) ? value : []) {
      const point = str(item?.point, 240);
      const evidence = str(item?.evidence, 300);
      const url = str(item?.url, 500);
      if (!point || !allowed.has(url) || FORBIDDEN.test(`${point} ${evidence}`)) {
        counter.dropped += 1;
        continue;
      }
      if (out.length < max) out.push({ point, evidence, url });
    }
    return out;
  };
}

export function validateCompare(text: string, input: ValidationInput): Checked<CompareResult> {
  const raw = parse(text);
  if (!raw) return { ok: false, reason: 'The comparison was not valid JSON.' };
  const domains = [input.own, ...input.competitors];
  const pagesOf = (d: string) => new Set(input.pages[d] ?? []);
  const counter = { dropped: 0 };
  const cited = citer(counter);

  const scores: CompareResult['scores'] = [];
  for (const item of Array.isArray(raw.scores) ? raw.scores : []) {
    const area = AREAS.find((a) => a.toLowerCase() === str(item?.area, 40).toLowerCase());
    if (!area || scores.some((s) => s.area === area)) continue;
    const values: Record<string, number> = {};
    for (const d of domains) {
      const v = item?.scores?.[d] ?? item?.scores?.[`www.${d}`];
      if (typeof v === 'number' && Number.isFinite(v)) values[d] = Math.round(Math.min(10, Math.max(0, v)));
    }
    if (values[input.own] === undefined || Object.keys(values).length < 2) continue;
    // The leader is computed from the scores, never taken from the model; a tie has no single leader.
    const top = Math.max(...Object.values(values));
    const leaders = Object.keys(values).filter((d) => values[d] === top);
    scores.push({ area, scores: values, leader: leaders.length === 1 ? leaders[0]! : null, note: str(item?.note, 200) });
  }
  scores.sort((a, b) => AREAS.indexOf(a.area) - AREAS.indexOf(b.area));
  const overall: Record<string, number> = {};
  for (const d of domains) {
    const vals = scores.map((s) => s.scores[d]).filter((v): v is number => v !== undefined);
    if (vals.length) overall[d] = Math.round((vals.reduce((a, b) => a + b, 0) / (vals.length * 10)) * 100);
  }

  const headToHead: CompareResult['headToHead'] = [];
  for (const item of Array.isArray(raw.headToHead) ? raw.headToHead : []) {
    const competitor = dom(item?.competitor);
    if (!input.competitors.includes(competitor) || headToHead.some((h) => h.competitor === competitor)) {
      counter.dropped += 1;
      continue;
    }
    const side = (value: unknown, allowed: Set<string>) => cited((Array.isArray(value) ? value : []).map((p: any) => ({ ...p, evidence: '' })), allowed, 4).map(({ point, url }) => ({ point, url }));
    headToHead.push({
      competitor,
      threat: oneOf(item?.threat, ['high', 'medium', 'low'] as const, 'medium'),
      threatReason: str(item?.threatReason, 240),
      theyLead: side(item?.theyLead, pagesOf(competitor)),
      youLead: side(item?.youLead, pagesOf(input.own)),
      verdict: str(item?.verdict, 240),
    });
  }
  headToHead.sort((a, b) => input.competitors.indexOf(a.competitor) - input.competitors.indexOf(b.competitor));

  const gaps: CompareResult['gaps'] = [];
  for (const item of Array.isArray(raw.gaps) ? raw.gaps : []) {
    const topic = str(item?.topic, 200);
    const competitors = strList(item?.competitors, 4, 200).map(dom).filter((d) => input.competitors.includes(d));
    const url = str(item?.url, 500);
    const allowed = new Set(competitors.flatMap((d) => input.pages[d] ?? []));
    if (!topic || !competitors.length || !allowed.has(url) || FORBIDDEN.test(topic)) {
      counter.dropped += 1;
      continue;
    }
    if (gaps.length < 10) gaps.push({ topic, competitors, why: str(item?.why, 300), url });
  }

  const actions: CompareResult['actions'] = [];
  const allPages = new Set(Object.values(input.pages).flat());
  for (const item of Array.isArray(raw.actions) ? raw.actions : []) {
    const action = str(item?.action, 300);
    const evidenceUrls = strList(item?.evidenceUrls, 4, 500).filter((url) => allPages.has(url));
    if (!action || FORBIDDEN.test(action) || !evidenceUrls.length) {
      counter.dropped += 1;
      continue;
    }
    const learnFrom = dom(item?.learnFrom);
    if (actions.length < 12) {
      actions.push({
        priority: oneOf(item?.priority, ['high', 'medium', 'low'] as const, 'medium'),
        action,
        reason: str(item?.reason, 300),
        effort: oneOf(item?.effort, ['low', 'medium', 'high'] as const, 'medium'),
        impact: oneOf(item?.impact, ['high', 'medium', 'low'] as const, 'medium'),
        when: oneOf(str(item?.when, 20).toLowerCase(), WHEN, 'this month'),
        learnFrom: input.competitors.includes(learnFrom) ? learnFrom : null,
        evidenceUrls,
      });
    }
  }

  const result: CompareResult = { overview: str(raw.overview, 900), scores, overall, headToHead, gaps, opportunities: strList(raw.opportunities, 5, 240), actions };
  if (!result.overview || !actions.length) return { ok: false, reason: 'The comparison had no overview or no actions.' };
  return { ok: true, result, dropped: counter.dropped };
}

export function validateProfiles(text: string, input: ValidationInput): Checked<ProfilesResult> {
  const raw = parse(text);
  if (!raw) return { ok: false, reason: 'The profiles were not valid JSON.' };
  const domains = [input.own, ...input.competitors];
  const known = new Set(domains);
  const counter = { dropped: 0 };
  const cited = citer(counter);

  const sites: ProfilesResult['sites'] = [];
  for (const item of Array.isArray(raw.sites) ? raw.sites : []) {
    const domain = dom(item?.domain);
    if (!known.has(domain) || sites.some((s) => s.domain === domain)) {
      counter.dropped += 1;
      continue;
    }
    const pages = new Set(input.pages[domain] ?? []);
    sites.push({
      domain,
      summary: str(item?.summary, 600),
      audience: str(item?.audience, 300),
      positioning: str(item?.positioning, 300),
      promise: str(item?.promise, 240),
      tone: str(item?.tone, 60),
      offerings: strList(item?.offerings, 6, 100),
      strengths: cited(item?.strengths, pages, 4),
      weaknesses: cited(item?.weaknesses, pages, 4),
    });
  }
  sites.sort((a, b) => domains.indexOf(a.domain) - domains.indexOf(b.domain));

  const clean = (v: unknown) => strList(v, 5, 200).filter((s) => {
    if (FORBIDDEN.test(s)) {
      counter.dropped += 1;
      return false;
    }
    return true;
  });
  const swot = { strengths: clean(raw.swot?.strengths), weaknesses: clean(raw.swot?.weaknesses), opportunities: clean(raw.swot?.opportunities), threats: clean(raw.swot?.threats) };

  const topics: ProfilesResult['topics'] = [];
  for (const item of Array.isArray(raw.topics) ? raw.topics : []) {
    const topic = str(item?.topic, 60);
    const covered = [...new Set(strList(item?.sites, 6, 200).map(dom).filter((d) => known.has(d)))];
    if (!topic || !covered.length || topics.some((t) => t.topic.toLowerCase() === topic.toLowerCase())) continue;
    if (topics.length < 16) topics.push({ topic, sites: covered.sort((a, b) => domains.indexOf(a) - domains.indexOf(b)) });
  }

  const contentIdeas: ProfilesResult['contentIdeas'] = [];
  for (const item of Array.isArray(raw.contentIdeas) ? raw.contentIdeas : []) {
    const title = str(item?.title, 160);
    if (!title || FORBIDDEN.test(title)) continue;
    const inspiredBy = dom(item?.inspiredBy);
    const outline = strList(item?.outline, 6, 120).filter((h) => !FORBIDDEN.test(h));
    const keywords = strList(item?.keywords, 6, 60).map((k) => k.toLowerCase()).filter((k) => !FORBIDDEN.test(k));
    if (contentIdeas.length < 8) contentIdeas.push({ title, format: oneOf(item?.format, ['page', 'blog', 'faq', 'video', 'guide'] as const, 'page'), why: str(item?.why, 240), inspiredBy: input.competitors.includes(inspiredBy) ? inspiredBy : null, outline, keywords: [...new Set(keywords)] });
  }

  if (!sites.some((s) => s.domain === input.own)) return { ok: false, reason: 'The profiles said nothing about the client site.' };
  return { ok: true, result: { sites, swot, topics, contentIdeas }, dropped: counter.dropped };
}

export const EMPTY_PROFILES: ProfilesResult = { sites: [], swot: { strengths: [], weaknesses: [], opportunities: [], threats: [] }, topics: [], contentIdeas: [] };
