import { AREAS, EMPTY_PROFILES, type AnalyzerResult, type Area, type CompareResult } from './analyzer-ai';
import type { FeatureAssertion, SiteEvidence } from './analyzer-evidence';

export interface AnalysisQuality {
  status: 'verified' | 'partial' | 'needs_review';
  score: number;
  issues: { severity: 'warning' | 'error'; domain: string | null; code: string; message: string }[];
  rule: 'No evidence = not verified';
}

const clamp = (value: number) => Math.max(0, Math.min(10, Math.round(value)));
const present = (feature: FeatureAssertion) => feature.state === 'present';
const unknown = (feature: FeatureAssertion) => feature.state === 'not_observed' || feature.state === 'render_failed';
const absentFeature = (): FeatureAssertion => ({ state: 'not_observed', evidence: [] });
const featuresOf = (site: SiteEvidence) => site.features ?? { blog: absentFeature(), contactForm: absentFeature(), phone: absentFeature(), email: absentFeature(), whatsapp: absentFeature(), portfolio: absentFeature(), clients: absentFeature(), testimonials: absentFeature() };

function siteScores(site: SiteEvidence): Partial<Record<Area, number>> {
  if (!site.reachable || site.coverage?.status === 'insufficient') return {};
  const home = site.pages[0];
  const tech = site.tech;
  const features = featuresOf(site);
  const out: Partial<Record<Area, number>> = {};
  if (home && tech) {
    out['Message clarity'] = clamp(
      (home.title ? 2 : 0) +
      (home.description ? 2 : 0) +
      (tech.h1Count === 1 ? 2 : tech.h1Count > 0 ? 1 : 0) +
      (tech.headline ? 2 : 0) +
      (home.words >= 120 ? 2 : home.words >= 50 ? 1 : 0),
    );
    out['Search basics'] = clamp(
      (tech.titleLength >= 30 && tech.titleLength <= 65 ? 1.5 : tech.titleLength ? 0.5 : 0) +
      (tech.descriptionLength >= 70 && tech.descriptionLength <= 170 ? 1.5 : tech.descriptionLength ? 0.5 : 0) +
      (tech.canonical ? 1.5 : 0) +
      (tech.openGraph ? 1 : 0) +
      (tech.viewport ? 1 : 0) +
      (tech.robotsTxt ? 1 : 0) +
      (tech.sitemapUrls ? 1.5 : 0) +
      (tech.imagesTotal === 0 || tech.imagesWithAlt / tech.imagesTotal >= 0.8 ? 1 : 0),
    );
  }
  out['Trust & proof'] = clamp(
    (present(features.portfolio) ? 2.5 : 0) +
    (present(features.testimonials) ? 2 : 0) +
    (present(features.clients) ? 1.5 : 0) +
    (site.metrics.schemaTypes.length ? 1.5 : 0) +
    (site.brand?.status === 'matched' ? 1.5 : site.brand?.status === 'possible' ? 0.5 : 0) +
    (site.https ? 1 : 0),
  );
  out['Calls to action'] = clamp(Math.min(5, site.metrics.ctas) * 1.2 + (present(features.contactForm) ? 2 : 0) + (present(features.whatsapp) ? 1 : 0) + (present(features.phone) || present(features.email) ? 1 : 0));
  out['Content depth'] = clamp(Math.min(3, site.metrics.pages / 2) + Math.min(3, site.metrics.words / 1800) + (present(features.blog) ? 2 : 0) + (present(features.portfolio) ? 2 : 0));
  const contactFeatures = [features.phone, features.email, features.whatsapp, features.contactForm];
  if (!contactFeatures.every(unknown) || contactFeatures.some(present)) out['Ease of contact'] = clamp(contactFeatures.filter(present).length * 2.5);
  if (site.speed?.performance != null) {
    const lcp = site.speed.lcpMs == null ? 0 : site.speed.lcpMs <= 2500 ? 2 : site.speed.lcpMs <= 4000 ? 1 : 0;
    out['Speed & mobile'] = clamp(site.speed.performance / 12.5 + lcp);
  }
  return out;
}

export function deterministicComparison(sites: SiteEvidence[]): Pick<CompareResult, 'scores' | 'overall'> {
  const perSite = Object.fromEntries(sites.map((site) => [site.domain, siteScores(site)]));
  const scores: CompareResult['scores'] = AREAS.map((area) => {
    const values = Object.fromEntries(sites.map((site) => [site.domain, perSite[site.domain]?.[area]]).filter((entry): entry is [string, number] => typeof entry[1] === 'number'));
    if (Object.keys(values).length < 2) return null;
    const top = Math.max(...Object.values(values));
    const leaders = Object.keys(values).filter((domain) => values[domain] === top);
    return { area, scores: values, leader: leaders.length === 1 ? leaders[0]! : null, note: 'Calculated from measured website evidence.' };
  }).filter((score): score is CompareResult['scores'][number] => score !== null);
  const overall: Record<string, number> = {};
  for (const site of sites) {
    const values = scores.map((score) => score.scores[site.domain]).filter((value): value is number => value !== undefined);
    if (values.length >= 5) overall[site.domain] = Math.round((values.reduce((sum, value) => sum + value, 0) / (values.length * 10)) * 100);
  }
  return { scores, overall };
}

/** Scores depend on measured evidence, never on whether a narrative provider answered. */
export function measuredAnalysis(sites:SiteEvidence[]):AnalyzerResult {
  return {...EMPTY_PROFILES,...deterministicComparison(sites),overview:'Measured website comparison. AI narrative is unavailable; scores use the saved website evidence.',headToHead:[],gaps:[],opportunities:[],actions:[]};
}

const featureAction = [
  { pattern: /\b(add|create|launch|build|start)\b.{0,35}\b(blog|news|insights?)\b/i, key: 'blog' as const },
  { pattern: /\b(add|create|build)\b.{0,35}\b(contact|enquiry|inquiry) form\b/i, key: 'contactForm' as const },
  { pattern: /\b(add|create|build)\b.{0,35}\b(project|portfolio|case stud|gallery)\b/i, key: 'portfolio' as const },
  { pattern: /\b(add|showcase|display)\b.{0,35}\b(testimonial|review)\b/i, key: 'testimonials' as const },
  { pattern: /\b(add|showcase|display)\b.{0,35}\b(client|brand) logos?\b/i, key: 'clients' as const },
];

export function validateRecommendations(result: AnalyzerResult, own: SiteEvidence): { result: AnalyzerResult; dropped: number } {
  let dropped = 0;
  const ownFeatures = featuresOf(own);
  const conflicts = (text: string) => featureAction.some(({ pattern, key }) => pattern.test(text) && ownFeatures[key].state === 'present');
  const actions = result.actions.filter((action) => {
    const invalid = conflicts(`${action.action} ${action.reason}`);
    if (invalid) dropped += 1;
    return !invalid;
  });
  const contentIdeas = result.contentIdeas.filter((idea) => {
    const invalid = conflicts(`${idea.title} ${idea.why} ${(idea.outline ?? []).join(' ')}`);
    if (invalid) dropped += 1;
    return !invalid;
  });
  return { result: { ...result, actions, contentIdeas }, dropped };
}

export function assessQuality(sites: SiteEvidence[], analysis: AnalyzerResult | null): AnalysisQuality {
  const issues: AnalysisQuality['issues'] = [];
  for (const site of sites) {
    if (!site.reachable) issues.push({ severity: site.role === 'own' ? 'error' : 'warning', domain: site.domain, code: 'site_unreadable', message: site.error ?? 'The website could not be read.' });
    const coverage = site.coverage;
    if (!coverage || coverage.status !== 'complete') issues.push({ severity: !coverage || coverage.status === 'insufficient' ? 'error' : 'warning', domain: site.domain, code: 'crawl_incomplete', message: `Key-page evidence confidence is ${coverage?.score ?? 0}%; missing features remain not verified.` });
    if (coverage?.failed) issues.push({ severity: 'warning', domain: site.domain, code: 'pages_failed', message: `${coverage.failed} selected page(s) could not be read.` });
    if (site.tech?.hasBlog === false && featuresOf(site).blog.state === 'present') issues.push({ severity: 'error', domain: site.domain, code: 'blog_contradiction', message: 'Blog evidence exists but the technical inventory marked it absent.' });
  }
  if (analysis && (analysis.scores.length < 5 || Object.keys(analysis.overall).length < 2)) issues.push({ severity: 'error', domain: null, code: 'scores_incomplete', message: 'Comparable deterministic scores could not be calculated for enough sites.' });
  const errors = issues.filter((issue) => issue.severity === 'error').length;
  const warnings = issues.length - errors;
  const score = Math.max(0, 100 - errors * 25 - warnings * 8);
  return { status: errors ? 'needs_review' : warnings ? 'partial' : 'verified', score, issues, rule: 'No evidence = not verified' };
}
