import { ANALYZER_VERSIONS } from "../config";
import type { SiteEvidence } from "../evidence/evidence";
import type { CheckCategory, CheckResult } from "./checks";

/*
 * Deterministic "measured website score" (Engine 12 of the comparison). Computed from check results only, so it is
 * available even when AI is unavailable, and the same evidence always gives the same score.
 *  - pass = 1, warn = 0.5, fail = 0 of the check's weight; unknown / not_applicable are EXCLUDED (unknown ≠ zero)
 *  - a category is scored only when ≥ 50% of its applicable check weight was evaluable
 *  - overall is reported only when scored categories cover ≥ 70% of the rubric weight; scored coverage is shown
 * This is NOT a business, market-share, service-quality or ranking score.
 */

export const CATEGORY_WEIGHTS: Record<CheckCategory, number> = {
  clarity: 20,
  contact: 20,
  trust: 20,
  services: 15,
  content: 10,
  technical: 10,
  performance: 5,
};
export const CATEGORY_LABELS: Record<CheckCategory, string> = {
  clarity: "Service & message clarity",
  contact: "Contact / enquiry journey",
  trust: "Trust & transparency",
  services: "Service & package information",
  content: "Content & helpfulness",
  technical: "Technical SEO",
  performance: "Mobile performance",
};
export const MIN_CATEGORY_COVERAGE = 0.5;
export const MIN_OVERALL_WEIGHT_COVERAGE = 0.7;

export interface CategoryScore {
  category: CheckCategory;
  label: string;
  weight: number;
  /** 0–100, null when evidence coverage is too low */
  score: number | null;
  coverage: number;
  evaluated: number;
  unknown: number;
  passed: number;
  failed: number;
}

export interface SiteScore {
  domain: string;
  categories: CategoryScore[];
  overall: number | null;
  /** Share of total rubric weight that was scored (0–1) */
  scoredWeight: number;
  rubricVersion: string;
  weightsVersion: "proposed-uncalibrated" | "quality-rubric-v2";
  evidenceCoverage?: number;
  calibration?: { status: "external_review_pending"; benchmark: string; note: string };
  /** Category weights actually used (admin settings at run time) */
  weights: Record<CheckCategory, number>;
}

export function scoreSite(domain: string, checks: CheckResult[], weights: Record<CheckCategory, number> = CATEGORY_WEIGHTS): SiteScore {
  const categories = (Object.keys(CATEGORY_WEIGHTS) as CheckCategory[]).map((category): CategoryScore => {
    const list = checks.filter((c) => c.category === category && c.state !== "not_applicable");
    const evaluated = list.filter((c) => c.state !== "unknown");
    const total = list.reduce((s, c) => s + c.weight, 0);
    const evalWeight = evaluated.reduce((s, c) => s + c.weight, 0);
    const earned = evaluated.reduce((s, c) => s + c.weight * (c.state === "pass" ? 1 : c.state === "warn" ? 0.5 : 0), 0);
    const coverage = total ? evalWeight / total : 0;
    return {
      category,
      label: CATEGORY_LABELS[category],
      weight: weights[category] ?? CATEGORY_WEIGHTS[category],
      score: coverage >= MIN_CATEGORY_COVERAGE && evalWeight > 0 ? Math.round((earned / evalWeight) * 100) : null,
      coverage: Math.round(coverage * 100) / 100,
      evaluated: evaluated.length,
      unknown: list.length - evaluated.length,
      passed: evaluated.filter((c) => c.state === "pass").length,
      failed: evaluated.filter((c) => c.state === "fail").length,
    };
  });
  const scored = categories.filter((c) => c.score !== null);
  const totalWeight = categories.reduce((a, c) => a + c.weight, 0) || 1;
  const scoredWeight = scored.reduce((s, c) => s + c.weight, 0) / totalWeight;
  const scoredSum = scored.reduce((s, c) => s + c.weight, 0);
  const overall = scoredWeight >= MIN_OVERALL_WEIGHT_COVERAGE && scoredSum > 0 ? Math.round(scored.reduce((s, c) => s + (c.score as number) * c.weight, 0) / scoredSum) : null;
  const evidenceCoverage = categories.reduce((s, c) => s + c.weight * c.coverage, 0) / totalWeight;
  return { domain, categories, overall, scoredWeight: Math.round(scoredWeight * 100) / 100, evidenceCoverage: Math.round(evidenceCoverage * 100), rubricVersion: ANALYZER_VERSIONS.rubric, weightsVersion: "quality-rubric-v2", calibration: { status: "external_review_pending", benchmark: "content-quality-fixtures-v1", note: "Observable-content rubric with fixture regression checks. Weights require independent review against representative real websites; this is not a validated business or search-ranking score." }, weights: Object.fromEntries(categories.map((c) => [c.category, c.weight])) as Record<CheckCategory, number> };
}

export interface ScopeComparison {
  competitor: string;
  sharedServices: string[];
  ownOnly: string[];
  competitorOnly: string[];
  overlap: number | null;
  comparable: boolean;
  note: string;
}

/** Service-scope overlap (Jaccard over evidenced service categories). Low overlap → no overall winner is declared. */
export function scopeComparison(own: SiteEvidence, competitor: SiteEvidence): ScopeComparison {
  const a = new Set(own.services.filter((s) => s.state === "present").map((s) => s.category));
  const b = new Set(competitor.services.filter((s) => s.state === "present").map((s) => s.category));
  const shared = [...a].filter((x) => b.has(x));
  const union = new Set([...a, ...b]);
  const overlap = union.size ? shared.length / union.size : null;
  const comparable = overlap !== null && overlap >= 0.3;
  return {
    competitor: competitor.domain,
    sharedServices: shared,
    ownOnly: [...a].filter((x) => !b.has(x)),
    competitorOnly: [...b].filter((x) => !a.has(x)),
    overlap: overlap === null ? null : Math.round(overlap * 100) / 100,
    comparable,
    note: overlap === null ? "Service scope could not be determined from the sampled pages; overall comparison not declared." : comparable ? "Service scopes overlap enough for a website comparison." : "Service scopes differ substantially; per-category comparison only, no overall winner.",
  };
}

export interface CategoryLeader {
  category: CheckCategory;
  label: string;
  scores: Record<string, number>;
  leader: string | null;
  tie: boolean;
}

export function categoryLeaders(scores: SiteScore[]): CategoryLeader[] {
  return (Object.keys(CATEGORY_WEIGHTS) as CheckCategory[]).map((category) => {
    const values: Record<string, number> = {};
    for (const s of scores) {
      const c = s.categories.find((x) => x.category === category);
      if (c?.score !== null && c?.score !== undefined) values[s.domain] = c.score;
    }
    const domains = Object.keys(values);
    if (domains.length < 2) return { category, label: CATEGORY_LABELS[category], scores: values, leader: null, tie: false };
    const top = Math.max(...Object.values(values));
    const leaders = domains.filter((d) => values[d] === top);
    return { category, label: CATEGORY_LABELS[category], scores: values, leader: leaders.length === 1 ? leaders[0] : null, tie: leaders.length > 1 };
  });
}
