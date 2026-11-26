import type { AnalyzerResult } from './analyzer-ai';
import type { SiteEvidence } from './analyzer-evidence';
import { assessQuality, measuredAnalysis, type AnalysisQuality } from './analyzer-intelligence';
import type { BusinessIntelligence } from './business-intelligence';

export interface CanonicalReportModel {
  businessIntelligence?:BusinessIntelligence|null;
  version: 'competitor-report-2';
  checkedAt: Date;
  sites: SiteEvidence[];
  analysis: AnalyzerResult | null;
  summary: string;
  quality: AnalysisQuality;
  businessThreat: {
    status: 'not_assessed';
    message: string;
  };
  methodology: {
    rule: 'No evidence = not verified';
    browserFallback: boolean;
    deterministicScores: true;
  };
}

export function buildCanonicalReportModel(run: { startedAt: Date; finishedAt: Date | null; sites: unknown; ai: unknown;businessIntelligence?:BusinessIntelligence|null }): CanonicalReportModel {
  const sites = (run.sites ?? []) as SiteEvidence[];
  const block = (run.ai ?? null) as { status?: string; result?: AnalyzerResult; quality?: AnalysisQuality } | null;
  const analysis = block?.result ?? measuredAnalysis(sites);
  const own = sites.find((site) => site.role === 'own');
  const ownScore = own ? analysis?.overall[own.domain] : undefined;
  const ranked = analysis ? Object.entries(analysis.overall).sort((a, b) => b[1] - a[1]) : [];
  const leader = ranked[0];
  const summary = ownScore == null
    ? 'Comparable scores are not available because the evidence is incomplete.'
    : leader?.[0] === own?.domain
      ? `Your website leads the measured website comparison with ${ownScore}/100.`
      : `Your measured website score is ${ownScore}/100; ${leader?.[0] ?? 'a competitor'} leads with ${leader?.[1] ?? 'a higher score'}/100.`;
  return {
    version: 'competitor-report-2',
    businessIntelligence:run.businessIntelligence??null,
    checkedAt: run.finishedAt ?? run.startedAt,
    sites,
    analysis,
    summary,
    quality: assessQuality(sites, analysis),
    businessThreat: {
      status: 'not_assessed',
      message: 'Business threat is not inferred from website quality. Add market, geography, service overlap and commercial data before assessing it.',
    },
    methodology: {
      rule: 'No evidence = not verified',
      browserFallback: sites.some((site) => (site.coverage?.rendered ?? 0) > 0),
      deterministicScores: true,
    },
  };
}
