import { describe, expect, it } from 'vitest';
import { siteMetrics } from '../../src/modules/website-intelligence/competitor-ai';
import type { AnalyzerResult } from '../../src/modules/competitor-analyzer/analyzer-ai';
import type { SiteEvidence } from '../../src/modules/competitor-analyzer/analyzer-evidence';
import { applyTranslations, collectStrings, hindiLabel, label, validateTranslations } from '../../src/modules/competitor-analyzer/analyzer-hindi';
import { renderAnalyzerPdf } from '../../src/modules/competitor-analyzer/analyzer-pdf';
import { buildReportPrompt, validateReport } from '../../src/modules/competitor-analyzer/analyzer-report';

const evidence = (domain: string, role: 'own' | 'competitor'): SiteEvidence => ({
  url: `https://${domain}/`, domain, role, reachable: true, error: null, name: domain, title: 'Home', description: 'Desc', image: null, screenshot: null, https: true,
  pages: [{ url: `https://${domain}/`, title: 'Home', description: 'Desc', words: 900, headings: 6, ctas: ['Register'] }],
  metrics: { ...siteMetrics({ domain, pages: [] }), pages: 1, words: 900, ctas: 4 },
  tech: { titleLength: 40, descriptionLength: 120, h1Count: 1, headline: 'Hi', canonical: true, openGraph: true, viewport: true, lang: 'en', imagesTotal: 10, imagesWithAlt: 6, internalLinks: 30, hasBlog: role === 'own', latestDate: null, robotsTxt: true, sitemapUrls: 20 },
  speed: { performance: role === 'own' ? 78 : 40, seo: 92, accessibility: 88, bestPractices: 90, lcpMs: role === 'own' ? 2100 : 6400, cls: 0.02, tbtMs: 120 }, speedError: null,
  brand: { status: 'not_found', name: null, description: null, wikipediaUrl: null },
});

const ai: AnalyzerResult = {
  overview: 'You lead on contact and speed; a.com leads on proof.',
  scores: [
    { area: 'Message clarity', scores: { 'mine.in': 8, 'a.com': 6 }, leader: 'mine.in', note: 'Clear headline' },
    { area: 'Trust & proof', scores: { 'mine.in': 5, 'a.com': 9 }, leader: 'a.com', note: 'Logos and numbers' },
    { area: 'Speed & mobile', scores: { 'mine.in': 8, 'a.com': 4 }, leader: 'mine.in', note: 'Faster on phones' },
  ],
  overall: { 'mine.in': 70, 'a.com': 63 },
  headToHead: [{ competitor: 'a.com', threat: 'high', threatReason: 'Same buyers', theyLead: [{ point: 'Visitor numbers', url: 'https://a.com/' }], youLead: [{ point: 'WhatsApp contact', url: 'https://mine.in/' }], verdict: 'Close race.' }],
  gaps: [{ topic: 'Exhibitor list', competitors: ['a.com'], why: 'Shows scale', url: 'https://a.com/' }],
  opportunities: ['Nobody shows prices'],
  actions: [
    { priority: 'high', action: 'Add visitor numbers', reason: 'a.com shows them', effort: 'low', impact: 'high', when: 'this week', learnFrom: 'a.com' },
    { priority: 'medium', action: 'Start a blog', reason: 'Fresh content', effort: 'medium', impact: 'medium', when: 'this quarter', learnFrom: null },
  ],
  sites: [
    { domain: 'mine.in', summary: 'An organic expo.', audience: 'Buyers', positioning: 'Big and green', promise: 'Meet buyers', tone: 'warm', offerings: ['Expo'], strengths: [{ point: 'Fast', evidence: 'PSI', url: 'https://mine.in/' }], weaknesses: [] },
    { domain: 'a.com', summary: 'A trade fair.', audience: 'Exhibitors', positioning: 'Established', promise: 'The meeting point', tone: 'formal', offerings: ['Fair'], strengths: [], weaknesses: [] },
  ],
  swot: { strengths: ['Fast site'], weaknesses: ['Thin proof'], opportunities: ['Add stats'], threats: ['a.com proof'] },
  topics: [{ topic: 'Organic certification', sites: ['a.com'] }, { topic: 'Trade fairs', sites: ['mine.in', 'a.com'] }],
  contentIdeas: [{ title: 'Exhibitor guide', format: 'guide', why: 'a.com has one', inspiredBy: 'a.com' }],
};

describe('report narrative', () => {
  it('sends the condensed analysis, not raw page text', () => {
    const p = buildReportPrompt({ own: 'mine.in', sites: [evidence('mine.in', 'own'), evidence('a.com', 'competitor')], ai });
    const data = JSON.parse(p.user.slice(p.user.indexOf('{')));
    expect(data.you).toBe('mine.in');
    expect(data.measured[0]).toMatchObject({ domain: 'mine.in', you: true, overall: 70, mobileSpeed: 78, sitemapPages: 20, altTextPct: 60 });
    expect(p.system).toMatch(/Never mention traffic/);
  });

  it('keeps clean sections, fixed roadmap phases and known competitors only', () => {
    const answer = {
      headline: 'You lead on speed and contact.',
      executiveSummary: 'You are ahead overall. a.com shows more proof.',
      keyFindings: [{ title: 'Fastest site', detail: 'Mobile speed 78.' }, { title: 'Proof gap', detail: 'a.com shows numbers.' }, { title: 'Huge traffic', detail: 'You get 10k monthly visits.' }, { title: 'Clear message', detail: 'Headline is clear.' }],
      competitors: [{ domain: 'www.a.com', summary: 'Strong proof.', watchOut: 'Numbers.', learnFrom: 'Logos.' }, { domain: 'z.org', summary: 'x' }],
      roadmap: [{ phase: 'Days 31–60', focus: 'Content', steps: ['Start a blog'] }, { phase: 'Days 1-30', focus: 'Proof', steps: ['Add numbers', ''] }, { phase: 'later', steps: ['x'] }],
      kpis: [{ metric: 'Overall score', why: 'Tracks progress', target: '75+' }, { metric: 'No target' }],
      closing: 'Keep going.',
    };
    const r = validateReport(JSON.stringify(answer), ['a.com']);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.result.keyFindings.map((f) => f.title)).toEqual(['Fastest site', 'Proof gap', 'Clear message']);
    expect(r.result.competitors.map((c) => c.domain)).toEqual(['a.com']);
    expect(r.result.roadmap.map((p) => [p.phase, p.steps])).toEqual([['Days 1-30', ['Add numbers']], ['Days 31-60', ['Start a blog']]]);
    expect(r.result.kpis).toEqual([{ metric: 'Overall score', why: 'Tracks progress', target: '75+' }]);
  });

  it('rejects an answer without summary, findings or roadmap', () => {
    expect(validateReport('{}', ['a.com']).ok).toBe(false);
    expect(validateReport('not json', ['a.com']).ok).toBe(false);
  });
});

describe('PDF', () => {
  const base = {
    studyName: 'mine.in vs a.com',
    preparedFor: 'Acme Org',
    generatedAt: new Date('2026-10-22T12:00:00Z'),
    checkedAt: new Date('2026-10-22T11:00:00Z'),
    sites: [{ url: 'https://mine.in/', domain: 'mine.in', role: 'own' as const }, { url: 'https://a.com/', domain: 'a.com', role: 'competitor' as const }],
    evidence: [evidence('mine.in', 'own'), evidence('a.com', 'competitor')],
  };

  it('renders a multi-page report with the analysis and the narrative', async () => {
    const pdf = await renderAnalyzerPdf({
      ...base,
      ai,
      aiNote: null,
      narrative: { headline: 'You lead.', executiveSummary: 'Summary.', keyFindings: [{ title: 'A', detail: 'B' }], competitors: [{ domain: 'a.com', summary: 'S', watchOut: 'W', learnFrom: 'L' }], roadmap: [{ phase: 'Days 1-30', focus: 'F', steps: ['S1'] }], kpis: [{ metric: 'Overall score', why: 'Y', target: '75' }], closing: 'C → done ✓' },
      changes: [{ domain: 'a.com', kind: 'speed', direction: 'up', text: 'Mobile speed score 40 → 52.' }],
    });
    expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
    const pages = (pdf.toString('latin1').match(/\/Type\s*\/Page[^s]/g) ?? []).length;
    expect(pages).toBeGreaterThanOrEqual(8);
  });

  it('renders the Hindi report with the bundled Devanagari font', async () => {
    const pdf = await renderAnalyzerPdf({ ...base, ai, aiNote: null, narrative: null, changes: null, lang: 'hi' });
    expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
    expect(pdf.toString('latin1')).toContain('Hind-Bold');
  });

  it('still renders when the AI part is missing', async () => {
    const pdf = await renderAnalyzerPdf({ ...base, ai: null, aiNote: 'AI insights are switched off.', narrative: null, changes: null });
    expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
    expect((pdf.toString('latin1').match(/\/Type\s*\/Page[^s]/g) ?? []).length).toBeGreaterThanOrEqual(3);
  });
});

describe('Hindi report text', () => {
  it('translates fixed labels and fills placeholders, keeping English unchanged', () => {
    expect(hindiLabel('KEY FINDINGS')).toBe('मुख्य निष्कर्ष');
    expect(hindiLabel('Visitor numbers')).toBeNull();
    expect(label('hi', 'Tied with {x}', { x: 'a.com' })).toBe('a.com के बराबर');
    expect(label('en', 'Tied with {x}', { x: 'a.com' })).toBe('Tied with a.com');
  });

  it('keeps only translations that are Hindi and still carry every domain and number', () => {
    const batch = [
      { id: 'a', text: 'a.com shows 120 exhibitors' },
      { id: 'b', text: 'Start a blog' },
      { id: 'c', text: 'Add prices' },
    ];
    const reply = JSON.stringify({ t: { a: 'a.com 120 प्रदर्शक दिखाता है', b: 'Start a blog', c: 'कीमतें जोड़ें', x: 'अतिरिक्त' } });
    expect(validateTranslations(reply, batch)).toEqual({ a: 'a.com 120 प्रदर्शक दिखाता है', c: 'कीमतें जोड़ें' });
    expect(validateTranslations('{"t":{"a":"प्रदर्शक दिखाता है"}}', batch)).toEqual({});
    expect(validateTranslations('not json', batch)).toEqual({});
  });

  it('collects the analysis text and puts translations back by id, English where missing', () => {
    const src = { ai, narrative: null, changes: [{ domain: 'a.com', kind: 'speed' as const, direction: 'up' as const, text: 'Faster.' }] };
    const ids = collectStrings(src).map((s) => s.id);
    expect(ids).toContain('o');
    expect(ids).toContain('ch0');
    const out = applyTranslations(src, { o: 'आप आगे हैं', ch0: 'तेज़।' });
    expect(out.ai?.overview).toBe('आप आगे हैं');
    expect(out.changes?.[0]?.text).toBe('तेज़।');
    expect(out.ai?.actions[0]?.action).toBe('Add visitor numbers');
    expect(out.ai?.overall).toEqual(ai.overall);
  });
});
