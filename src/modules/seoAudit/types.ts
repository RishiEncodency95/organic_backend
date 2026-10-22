/**
 * Shared types for the REAL SEO audit engine.
 *
 * Every field here is filled from a live network call (crawler, Google
 * PageSpeed Insights API, Search Console API, DNS/TLS lookups, LLM APIs).
 * Nothing in this module is seeded, mocked or derived from static constants.
 */

export type CheckupStatus = "passed" | "failed" | "warning";
export type CheckupLevel = "site" | "page";
export type CheckupSource = "measured" | "crawl" | "derived";

export interface CheckupTable {
  title?: string;
  headers: string[];
  rows: Array<Array<string | number>>;
}

export interface CheckupStat {
  label: string;
  value: string;
  tone?: "green" | "blue" | "indigo" | "amber" | "red";
}

export interface CheckupList {
  title?: string;
  items: string[];
}

export interface CheckupMeta {
  label?: string;
  value: string;
  mono?: boolean;
}

export interface CheckupTest {
  id: string;
  name: string;
  status: CheckupStatus;
  level?: CheckupLevel;
  source?: CheckupSource;
  benchmark?: string;
  summary?: string;
  badge?: string;
  meta?: CheckupMeta[];
  stats?: CheckupStat[];
  tables?: CheckupTable[];
  lists?: CheckupList[];
  evidence?: string[];
  fix?: string;
  collapsible?: boolean;
}

export interface CheckupGroup {
  id: string;
  name: string;
  note?: string;
  score?: number;
  badge?: string;
  headline?: { value: string; label: string };
  tests: CheckupTest[];
}

export type CheckupPriority = "HIGH" | "MEDIUM" | "LOW";

export interface CheckupIssue {
  priority: CheckupPriority;
  title: string;
  detail?: string;
  fix?: string;
  collapsible?: boolean;
  status?: CheckupStatus;
  route?: string;
  group?: string;
  evidence?: string[];
}

export interface CheckupCategory {
  name: string;
  score?: number;
  failed: number;
  warnings: number;
  passed: number;
}

export interface ReportInput {
  label: string;
  value: string;
  source?: CheckupSource;
  status?: CheckupStatus;
}

export interface PageSpeedSnapshot {
  ok: boolean;
  message?: string;
  url: string;
  strategy: "mobile" | "desktop";
  fetchedAt: string;
  cached: boolean;
  scores: {
    performance: number | null;
    accessibility: number | null;
    bestPractices: number | null;
    seo: number | null;
  };
  metrics: {
    fcpMs: number | null;
    lcpMs: number | null;
    tbtMs: number | null;
    cls: number | null;
    siMs: number | null;
    ttfbMs: number | null;
    htmlKb: number | null;
    payloadKb: number | null;
    totalRequests: number | null;
    domNodes: number | null;
    imageRequests: number | null;
    javascriptKb: number | null;
    cssKb: number | null;
    fontKb: number | null;
    otherKb: number | null;
  };
  fieldData: { available: boolean; overall: string | null };
}

/** Per-route summary used by charts & the pages table. */
export interface RouteSummary {
  id: string;
  path: string;
  label: string;
  url: string;
  title: string | null;
  titleLength: number;
  metaDescription: string | null;
  metaDescriptionLength: number;
  httpStatus: number | null;
  ok: boolean;
  indexable: boolean;
  canonical: string | null;
  canonicalStatus: "missing" | "self" | "points_elsewhere";
  score: number;
  words: number;
  internalLinks: number;
  externalLinks: number;
  h1Count: number;
  h2Count: number;
  imageCount: number;
  imagesMissingAlt: number;
  domNodes: number | null;
  htmlKb: number | null;
  ttfbMs: number | null;
  loadMs: number | null;
  failedChecks: number;
  warningChecks: number;
  passedChecks: number;
  searchConsole: {
    available: boolean;
    clicks: number | null;
    impressions: number | null;
    ctr: number | null;
    position: number | null;
  };
}

export interface LlmPlatformResult {
  platform: string;
  model: string;
  tested: boolean;
  reason?: string;
  results: Array<{
    query: string;
    mentioned: boolean;
    citedDomain: boolean;
    excerpt: string;
  }>;
}

export interface SeoCheckupReportData {
  scope: "site" | "page";
  route: string;
  url: string;
  pageTitle: string;
  pageDesc: string | null;
  titleLen: number;
  descLen: number | null;
  seoScore: number;
  aiScore: number | null;
  scoreSource: CheckupSource;
  aiSource: CheckupSource | "not_tested";
  telemetrySource: CheckupSource | "not_connected";
  failedCount: number;
  warningCount: number;
  passedCount: number;
  totalCount: number;
  summary: string;
  categories: CheckupCategory[];
  inputs: ReportInput[];
  issues: CheckupIssue[];
  groups: CheckupGroup[];
  generatedAt: string;
  pageSpeed: PageSpeedSnapshot | null;
  routeSummaries: RouteSummary[];
  site: {
    origin: string;
    routesCrawled: number;
    avgWords: number;
    avgTtfbMs: number | null;
    searchConsoleConfigured: boolean;
    llmKeysConfigured: string[];
  };
}
