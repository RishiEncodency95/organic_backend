/**
 * PageSpeed Insights v5 (Lighthouse lab data + CrUX field data) for ONE URL and
 * ONE device. The parser keeps three measurement kinds apart, and never turns a
 * missing metric into 0:
 *   - lab:    Lighthouse run made by Google for this URL right now
 *   - field:  Chrome UX Report p75 values for this exact URL (when Google has them)
 *   - origin: Chrome UX Report p75 values for the whole origin (a different thing)
 */

import { classifyGoogleError, googleEndpoint, googleFetch, type GoogleFailure } from './website-google';

export type Device = 'mobile' | 'desktop';
export type MetricCategory = 'good' | 'needs-improvement' | 'poor';

export interface FieldMetric { p75: number; category: MetricCategory | null; distribution: { good: number; needsImprovement: number; poor: number } | null; }
export interface FieldBlock {
  scope: 'url' | 'origin';
  /** Where the numbers came from. PSI embeds the same CrUX data; the CrUX API adds history and explicit scoping. */
  source: 'psi-loadingExperience' | 'crux-api';
  formFactor: string | null;
  overallCategory: MetricCategory | null;
  collectionPeriod: { start: string; end: string } | null;
  metrics: { lcpMs?: FieldMetric; inpMs?: FieldMetric; cls?: FieldMetric; fcpMs?: FieldMetric; ttfbMs?: FieldMetric };
}

export interface PsiAudit {
  device: Device;
  requestedUrl: string;
  finalUrl: string;
  measuredAt: string;
  lighthouseVersion: string | null;
  scores: { performance: number | null; accessibility: number | null; seo: number | null; bestPractices: number | null };
  lab: { fcpMs: number | null; lcpMs: number | null; speedIndexMs: number | null; tbtMs: number | null; cls: number | null; ttfbMs: number | null };
  field: FieldBlock | null;
  originField: FieldBlock | null;
  resources: { requests: number | null; totalKb: number | null; byType: { type: string; label: string; requests: number; kb: number }[] };
  thirdParty: { name: string; kb: number; blockingMs: number; mainThreadMs: number }[];
  opportunities: { id: string; title: string; savingsMs: number | null; savingsKb: number | null; displayValue: string | null }[];
  diagnostics: { id: string; title: string; displayValue: string | null; score: number | null }[];
  accessibilityFailures: { id: string; title: string; description: string; count: number }[];
  /** Lighthouse's final screenshot (JPEG data URL); only when asked for, because it is tens of kilobytes. */
  screenshot?: string | null;
}

const FIELD_KEYS = {
  lcpMs: 'LARGEST_CONTENTFUL_PAINT_MS',
  inpMs: 'INTERACTION_TO_NEXT_PAINT',
  cls: 'CUMULATIVE_LAYOUT_SHIFT_SCORE',
  fcpMs: 'FIRST_CONTENTFUL_PAINT_MS',
  ttfbMs: 'EXPERIMENTAL_TIME_TO_FIRST_BYTE',
} as const;

const categoryOf = (value: unknown): MetricCategory | null => {
  const v = String(value ?? '').toUpperCase();
  return v === 'FAST' ? 'good' : v === 'AVERAGE' ? 'needs-improvement' : v === 'SLOW' ? 'poor' : null;
};

const num = (value: unknown): number | null => (typeof value === 'number' && Number.isFinite(value) ? value : null);
const pct = (score: unknown): number | null => (typeof score === 'number' ? Math.round(score * 100) : null);

function parseField(block: any, scope: 'url' | 'origin'): FieldBlock | null {
  const metrics = block?.metrics;
  if (!metrics || typeof metrics !== 'object' || !Object.keys(metrics).length) return null;
  const out: FieldBlock['metrics'] = {};
  for (const [key, psiKey] of Object.entries(FIELD_KEYS) as [keyof FieldBlock['metrics'], string][]) {
    const m = metrics[psiKey];
    const percentile = num(m?.percentile);
    if (percentile === null) continue;
    const d = m?.distributions;
    out[key] = {
      // PSI reports CLS ×100.
      p75: key === 'cls' ? percentile / 100 : percentile,
      category: categoryOf(m?.category),
      distribution: Array.isArray(d) && d.length === 3 ? { good: Math.round(d[0].proportion * 100), needsImprovement: Math.round(d[1].proportion * 100), poor: Math.round(d[2].proportion * 100) } : null,
    };
  }
  if (!Object.keys(out).length) return null;
  return { scope, source: 'psi-loadingExperience', formFactor: null, overallCategory: categoryOf(block?.overall_category), collectionPeriod: null, metrics: out };
}

/** Normalises a PSI v5 response. Returns null when it has no Lighthouse result at all. */
export function parsePageSpeed(json: any, device: Device, requestedUrl: string, now = new Date(), opts: { screenshot?: boolean } = {}): PsiAudit | null {
  const lh = json?.lighthouseResult;
  if (!lh?.audits || !lh?.categories) return null;
  const audits = lh.audits as Record<string, any>;
  const numeric = (id: string) => num(audits[id]?.numericValue);

  const resourceItems: any[] = audits['resource-summary']?.details?.items ?? [];
  const total = resourceItems.find((i) => i.resourceType === 'total');
  const totalBytes = num(total?.transferSize);
  const byType = resourceItems
    .filter((i) => i.resourceType !== 'total' && i.resourceType !== 'third-party')
    .map((i) => ({ type: String(i.resourceType), label: String(i.label ?? i.resourceType), requests: Number(i.requestCount ?? 0), kb: Math.round(Number(i.transferSize ?? 0) / 1024) }));

  const thirdParty = ((audits['third-party-summary']?.details?.items ?? []) as any[])
    .filter((i) => typeof i.entity === 'string' && i.entity)
    .map((i) => ({ name: i.entity as string, kb: Math.round(Number(i.transferSize ?? 0) / 1024), blockingMs: Math.round(Number(i.blockingTime ?? 0)), mainThreadMs: Math.round(Number(i.mainThreadTime ?? 0)) }));

  // Opportunities carry Lighthouse's own estimated savings; nothing is invented when they are absent.
  const opportunities = Object.entries(audits)
    .filter(([, a]) => a?.details?.type === 'opportunity' && (num(a.details.overallSavingsMs) ?? 0) > 0)
    .map(([id, a]) => ({ id, title: String(a.title ?? id), savingsMs: num(a.details.overallSavingsMs), savingsKb: num(a.details.overallSavingsBytes) !== null ? Math.round((a.details.overallSavingsBytes as number) / 1024) : null, displayValue: a.displayValue ? String(a.displayValue) : null }))
    .sort((a, b) => (b.savingsMs ?? 0) - (a.savingsMs ?? 0))
    .slice(0, 12);

  const diagnosticIds = ['dom-size', 'mainthread-work-breakdown', 'bootup-time', 'font-display', 'long-tasks', 'total-byte-weight', 'critical-request-chains', 'network-requests-count'];
  const diagnostics = diagnosticIds
    .filter((id) => audits[id] && audits[id].scoreDisplayMode !== 'notApplicable')
    .map((id) => ({ id, title: String(audits[id].title ?? id), displayValue: audits[id].displayValue ? String(audits[id].displayValue) : null, score: num(audits[id].score) }));

  // Accessibility: failed automated audits only. This is not a WCAG conformance statement.
  const a11yRefs: any[] = lh.categories.accessibility?.auditRefs ?? [];
  const accessibilityFailures = a11yRefs
    .map((ref) => ({ ref, audit: audits[ref.id] }))
    .filter(({ audit }) => audit && audit.scoreDisplayMode === 'binary' && audit.score === 0)
    .map(({ audit }) => ({ id: String(audit.id), title: String(audit.title ?? audit.id), description: String(audit.description ?? '').replace(/\s*\[Learn more[\s\S]*$/i, '').slice(0, 300), count: Array.isArray(audit.details?.items) ? audit.details.items.length : 1 }))
    .slice(0, 25);

  const requests = num(audits['network-requests']?.details?.items?.length) ?? num(total?.requestCount);

  return {
    device,
    requestedUrl,
    finalUrl: String(lh.finalDisplayedUrl ?? lh.finalUrl ?? json?.id ?? requestedUrl),
    measuredAt: now.toISOString(),
    lighthouseVersion: lh.lighthouseVersion ? String(lh.lighthouseVersion) : null,
    scores: {
      performance: pct(lh.categories.performance?.score),
      accessibility: pct(lh.categories.accessibility?.score),
      seo: pct(lh.categories.seo?.score),
      bestPractices: pct(lh.categories['best-practices']?.score),
    },
    lab: {
      fcpMs: numeric('first-contentful-paint'),
      lcpMs: numeric('largest-contentful-paint'),
      speedIndexMs: numeric('speed-index'),
      // Total Blocking Time is a LAB proxy. It is never presented as INP.
      tbtMs: numeric('total-blocking-time'),
      cls: numeric('cumulative-layout-shift'),
      ttfbMs: numeric('server-response-time'),
    },
    field: parseField(json?.loadingExperience && !json.loadingExperience.origin_fallback ? json.loadingExperience : null, 'url'),
    // A loadingExperience flagged origin_fallback is origin data even though it sits in the "url" slot.
    originField: parseField(json?.originLoadingExperience ?? (json?.loadingExperience?.origin_fallback ? json.loadingExperience : null), 'origin'),
    resources: { requests, totalKb: totalBytes !== null ? Math.round(totalBytes / 1024) : null, byType },
    thirdParty,
    opportunities,
    diagnostics,
    accessibilityFailures,
    ...(opts.screenshot ? { screenshot: screenshotOf(audits['final-screenshot']?.details?.data) } : {}),
  };
}

const screenshotOf = (data: unknown) => (typeof data === 'string' && /^data:image\/(jpeg|png|webp);base64,/.test(data) && data.length < 400_000 ? data : null);

export type PsiResult = { ok: true; audit: PsiAudit } | GoogleFailure;

export interface PsiClientOptions {
  apiKey: string | null;
  fetcher?: typeof fetch;
  timeoutMs?: number;
  retries?: number;
  sleep?: (ms: number) => Promise<void>;
  includeScreenshot?: boolean;
}

/** One PSI run with bounded retries on transient failures. Never throws. */
export async function runPageSpeed(url: string, device: Device, options: PsiClientOptions): Promise<PsiResult> {
  if (!options.apiKey) {
    return { ok: false, code: 'not_configured', message: 'PageSpeed Insights is not configured on the server (PAGESPEED_API_KEY).', httpStatus: null, retryable: false };
  }
  const sleep = options.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  const retries = options.retries ?? 2;
  const query = new URLSearchParams({ url, strategy: device, key: options.apiKey });
  for (const category of ['PERFORMANCE', 'ACCESSIBILITY', 'SEO', 'BEST_PRACTICES']) query.append('category', category);
  const endpoint = `${googleEndpoint('pagespeed')}?${query.toString()}`;
  let last: GoogleFailure | null = null;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const response = await googleFetch(endpoint, {}, options.timeoutMs ?? 75_000, options.fetcher);
    if (response.ok) {
      if (response.httpOk) {
        const audit = parsePageSpeed(response.body, device, url, new Date(), { screenshot: options.includeScreenshot });
        if (audit) return { ok: true, audit };
        return { ok: false, code: 'failed', message: 'PageSpeed Insights returned no Lighthouse result for this URL.', httpStatus: response.status, retryable: false };
      }
      last = classifyGoogleError('PageSpeed Insights', response.status, response.body);
    } else {
      last = response;
    }
    // Quota and configuration errors do not get better by retrying immediately.
    if (!last.retryable || last.code === 'quota_exceeded' || attempt === retries) break;
    await sleep(1000 * 3 ** attempt);
  }
  return last as GoogleFailure;
}
