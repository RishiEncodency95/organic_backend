import type { SiteEvidence } from './analyzer-evidence';
import type { AnalyzerRepository } from './repository';
import type { JourneyRule } from './journey-intelligence';

export interface BusinessProfile { id: string; label: string; importantPaths?: RegExp[]; journeys?:JourneyRule[]; rules: { key: string; label: string; terms: RegExp; weight: number }[] }
/** Business rules live outside the core engine. Never replace the source scoring formula. */
export const BUSINESS_PROFILES: BusinessProfile[] = [
  { id: 'general-v1', label: 'General website', rules: [] },
  { id: 'expo-v1', label: 'Exhibition and trade event', importantPaths: [/exhibitor.*(?:regist|book)|book.*(?:stall|stand)/i, /(?:visitor|buyer).*regist/i, /sponsor/i, /exhibitor.*(?:list|director|categor)/i], journeys:[
    {key:'exhibitor',label:'Exhibitor registration',paths:/exhibitor.*(?:regist|book)|book.*(?:stall|stand)/i},
    {key:'visitor',label:'Visitor and buyer registration',paths:/(?:visitor|buyer).*regist/i},
    {key:'enquiry',label:'Enquiry experience',paths:/contact|enquir|inquir/i},
  ], rules: [
    { key: 'exhibitor', label: 'Exhibitor registration', terms: /(?:exhibit(?:or)?|stall|stand).{0,50}(?:register|registration|book|apply)|(?:register|book).{0,50}(?:exhibit|stall|stand)/i, weight: 18 },
    { key: 'visitor', label: 'Visitor and buyer registration', terms: /(?:visitor|buyer).{0,40}(?:registration|register|pass)|register.{0,40}(?:visitor|buyer)/i, weight: 15 },
    { key: 'sponsor', label: 'Sponsorship visibility', terms: /sponsor(?:ship|s|ing)?/i, weight: 12 },
    { key: 'directory', label: 'Exhibitor directory and categories', terms: /exhibitor.{0,30}(?:list|director|categor)|(?:list|director|categor).{0,30}exhibitor/i, weight: 12 },
    { key: 'venue', label: 'Venue and event details', terms: /venue|event dates?|exhibition (?:centre|center)|convention cent(?:re|er)/i, weight: 13 },
    { key: 'matchmaking', label: 'Business matchmaking', terms: /matchmaking|buyer.?seller|business meetings?|b2b meetings?/i, weight: 12 },
    { key: 'trust', label: 'Trust signals', terms: /testimonial|accredit|certifi|official partner|supported by/i, weight: 8 },
    { key: 'enquiry', label: 'Enquiry experience', terms: /enquir|inquir|contact us|request.{0,20}(?:call|quote)|whatsapp/i, weight: 10 },
  ] },
];
BUSINESS_PROFILES.push({...BUSINESS_PROFILES[1]!,id:'expo-organic-v1',label:'Expo & Organic Industry Intelligence',importantPaths:[/exhibitor.*(?:regist|book)|book.*(?:stall|stand)/i,/(?:visitor|buyer).*regist/i,/sponsor|partner/i,/venue|conference|summit/i,/exhibitor.*(?:list|director|categor)/i,/organic|certif|sustainab/i],rules:[...BUSINESS_PROFILES[1]!.rules,
  {key:'organic',label:'Organic industry positioning',terms:/organic|herbal|ayurved|natural product/i,weight:12},
  {key:'certification',label:'Certification and sustainability positioning',terms:/certif|sustainab|usda|npop|gots|apeda/i,weight:10},
  {key:'conference',label:'Conference and knowledge programme',terms:/conference|seminar|speaker|summit|workshop/i,weight:10},
]});
export function evaluateProfile(profileId: string, evidence: SiteEvidence[]) {
  const profile = BUSINESS_PROFILES.find(p => p.id === profileId);
  if (!profile) throw new Error('Unknown scoring profile');
  return { version: profile.id, label: profile.label, separateFromCoreScores: true, sites: evidence.map(site => {
    const rules = profile.rules.map(rule => {
      const sources = site.pages.flatMap(page => {
        const observation=site.businessPages?.find(item=>item.url===page.url);
        const body=observation?.text??'';
        const match=rule.terms.exec(body);
        const bodySnippet=match?body.slice(Math.max(0,match.index-60),match.index+match[0].length+140):'';
        const candidates = [bodySnippet,page.title, page.description, page.h1 ?? '', ...page.ctas].filter(Boolean);
        const snippet = candidates.find(text => rule.terms.test(text));
        return snippet ? [{ url: page.url, snippet: snippet.slice(0, 300), method: page.method ?? 'static' }] : [];
      }).slice(0, 4);
      return { key: rule.key, label: rule.label, weight: rule.weight, state: sources.length ? 'present' : 'not_observed',
        confidence: sources.length ? (sources.length>1 ? 'high' : 'medium') : 'unknown',
        kind: 'observed_page_claim', verifiedJourney: false, evidence: sources };
    });
    const total = rules.reduce((sum, rule) => sum + rule.weight, 0);
    return { domain: site.domain, coverage: site.coverage?.status ?? 'insufficient', journeys:site.journeys??[],
      observedCapabilityScore: total && site.reachable && site.coverage?.status !== 'insufficient' ? Math.round(rules.filter(r => r.state === 'present').reduce((sum,r) => sum+r.weight,0) / total * 100) : null,
      note: 'Scores describe observed page signals. Registration completion, leads, revenue and conversion rates were not measured.', rules };
  }) };
}
export async function saveProfileResults(runId: string, profile: string, evidence: SiteEvidence[], repository: AnalyzerRepository) {
  await repository.competitorStudyRun.updateMany({ where: { id: runId, status: 'running' }, data: { profileResults: evaluateProfile(profile, evidence) } });
}
