import type { AnalyzerResult } from './analyzer-ai';
import type { SiteEvidence } from './analyzer-evidence';

export const REPORT_PROMPT_VERSION = 'cmpz-report-2026-10-22.1';
const PHASES = ['Days 1-30', 'Days 31-60', 'Days 61-90'] as const;

export interface ReportNarrative {
  headline: string;
  executiveSummary: string;
  keyFindings: { title: string; detail: string }[];
  competitors: { domain: string; summary: string; watchOut: string; learnFrom: string }[];
  roadmap: { phase: (typeof PHASES)[number]; focus: string; steps: string[] }[];
  kpis: { metric: string; why: string; target: string }[];
  closing: string;
}

const SYSTEM = `You are a senior digital strategy consultant writing the narrative of a competitor report for the business that owns the first website ("you").
Use ONLY the analysis data provided. Do not add facts, numbers or claims that are not in it.
Never mention traffic, search rankings, backlinks, revenue, sales or follower counts.
Write warm, confident, plain English for a business owner. Address the client as "you" / "your site"; name competitors by domain. Never write CLIENT or COMPETITOR.
Return only a JSON object with exactly these keys:
{
  "headline": "one sentence that sums up where you stand",
  "executiveSummary": "4 to 6 sentences: position, biggest strengths, biggest gaps, what to do first",
  "keyFindings": [{"title": "max 8 words", "detail": "max 35 words, with the evidence from the data"}],
  "competitors": [{"domain": "<competitor domain>", "summary": "2 sentences on how they compete with you", "watchOut": "one sentence", "learnFrom": "one sentence"}],
  "roadmap": [{"phase": "Days 1-30|Days 31-60|Days 61-90", "focus": "max 8 words", "steps": ["3 to 5 concrete steps, max 16 words each"]}],
  "kpis": [{"metric": "something this tool measures (overall score, area scores, mobile speed score, words on key pages, pages in sitemap, calls to action, structured data, alt text coverage)", "why": "max 18 words", "target": "a target relative to today's value in the data"}],
  "closing": "2 to 3 sentences of final advice"
}
Rules: keyFindings 5 to 7; one competitors entry per competitor; roadmap has exactly the three phases in order; kpis 4 to 6.`;

/** The analysis condensed to what the narrative needs; keeps the prompt small. */
export function buildReportPrompt(input: { own: string; sites: SiteEvidence[]; ai: AnalyzerResult }): { system: string; user: string } {
  const { ai, sites, own } = input;
  const measured = sites.map((s) => ({
    domain: s.domain,
    you: s.domain === own,
    reachable: s.reachable,
    overall: ai.overall[s.domain] ?? null,
    pagesRead: s.metrics.pages,
    words: s.metrics.words,
    callsToAction: s.metrics.ctas,
    contact: s.metrics.contact,
    socialProfiles: s.metrics.social.length,
    structuredData: s.metrics.schemaTypes.length,
    mobileSpeed: s.speed?.performance ?? null,
    seoScore: s.speed?.seo ?? null,
    sitemapPages: s.tech?.sitemapUrls ?? null,
    altTextPct: s.tech && s.tech.imagesTotal ? Math.round((s.tech.imagesWithAlt / s.tech.imagesTotal) * 100) : null,
    blog: s.tech?.hasBlog ?? null,
    googleKnowsBrand: s.brand ? s.brand.status === 'matched' : null,
  }));
  const data = {
    you: own,
    overview: ai.overview,
    scores: ai.scores.map((s) => ({ area: s.area, scores: s.scores, leader: s.leader, note: s.note })),
    measured,
    swot: ai.swot ?? null,
    headToHead: ai.headToHead.map((h) => ({ competitor: h.competitor, threat: h.threat, threatReason: h.threatReason, verdict: h.verdict, theyLead: h.theyLead.map((p) => p.point), youLead: h.youLead.map((p) => p.point) })),
    gaps: ai.gaps.map((g) => ({ topic: g.topic, competitors: g.competitors, why: g.why })),
    opportunities: ai.opportunities,
    actions: ai.actions.map((a) => ({ action: a.action, when: a.when, impact: a.impact, effort: a.effort, learnFrom: a.learnFrom })),
    contentIdeas: (ai.contentIdeas ?? []).map((c) => c.title),
  };
  return { system: SYSTEM, user: `Analysis data (JSON):\n${JSON.stringify(data)}` };
}

const str = (v: unknown, max: number) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, max) : '');
const dom = (v: unknown) => str(v, 200).toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/.*$/, '');
const FORBIDDEN = /\b(traffic|visitors per|monthly visits|backlinks?|domain authority|ranks? (#|number|first|1st) (on|in) google|revenue|turnover|followers|sales figures?)\b/i;
const clean = (v: unknown, max: number) => {
  const s = str(v, max);
  return s && !FORBIDDEN.test(s) && !/\b(CLIENT|COMPETITOR)\b/.test(s) ? s : '';
};

export function validateReport(text: string, competitors: string[]): { ok: true; result: ReportNarrative } | { ok: false; reason: string } {
  let raw: any;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, reason: 'The report text was not valid JSON.' };
  }
  if (!raw || typeof raw !== 'object') return { ok: false, reason: 'The report text was empty.' };
  const list = (v: unknown) => (Array.isArray(v) ? v : []);
  const result: ReportNarrative = {
    headline: clean(raw.headline, 240),
    executiveSummary: clean(raw.executiveSummary, 1400),
    keyFindings: list(raw.keyFindings).map((f: any) => ({ title: clean(f?.title, 90), detail: clean(f?.detail, 320) })).filter((f) => f.title && f.detail).slice(0, 7),
    competitors: list(raw.competitors)
      .map((c: any) => ({ domain: dom(c?.domain), summary: clean(c?.summary, 420), watchOut: clean(c?.watchOut, 240), learnFrom: clean(c?.learnFrom, 240) }))
      .filter((c, i, all) => competitors.includes(c.domain) && c.summary && all.findIndex((x) => x.domain === c.domain) === i)
      .sort((a, b) => competitors.indexOf(a.domain) - competitors.indexOf(b.domain)),
    roadmap: PHASES.map((phase) => {
      const item = list(raw.roadmap).find((r: any) => str(r?.phase, 20).toLowerCase().replace(/[–—]/g, '-') === phase.toLowerCase());
      return { phase, focus: clean(item?.focus, 90), steps: list(item?.steps).map((s) => clean(s, 200)).filter(Boolean).slice(0, 5) };
    }).filter((r) => r.steps.length),
    kpis: list(raw.kpis).map((k: any) => ({ metric: clean(k?.metric, 80), why: clean(k?.why, 200), target: clean(k?.target, 120) })).filter((k) => k.metric && k.target).slice(0, 6),
    closing: clean(raw.closing, 700),
  };
  if (!result.headline || !result.executiveSummary || result.keyFindings.length < 3 || !result.roadmap.length) {
    return { ok: false, reason: 'The report text was missing its summary, findings or roadmap.' };
  }
  return { ok: true, result };
}
