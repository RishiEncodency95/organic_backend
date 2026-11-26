import { CompetitorRun, CompetitorSnapshot, CompetitorStudy, SITE_SCOPE } from "../../../models/competitorAnalyzer";
import { logger } from "../../../utils/logger";
import { diffSnapshots, type SiteDiff } from "../analysis/changes";
import { CHECKS, runChecks, type CheckResult } from "../analysis/checks";
import { categoryLeaders, scopeComparison, scoreSite, type SiteScore } from "../analysis/scoring";
import { matchingPages } from "../analysis/pageMatching";
import { budgetedCall } from "../ai/budget";
import { buildComparisonPrompt, COMPARISON_PROMPT_VERSION, COMPARISON_SCHEMA } from "../ai/prompts";
import { OpenAiProvider, type AiProvider, type AiUsage } from "../ai/provider";
import { SourceSet, validateComparison, type ValidatedComparison } from "../ai/validate";
import { analyzerConfig, ANALYZER_VERSIONS } from "../config";
import { crawlSite, type Renderer, type SiteCrawl } from "../crawler/crawler";
import { makeSafeFetcher, type Fetcher } from "../crawler/safeFetch";
import { buildSiteEvidence, type SiteEvidence } from "../evidence/evidence";
import { compileBusinessConfig, loadActiveSettings, type ActiveSettings } from "../settings";
import { withBusinessConfig } from "../taxonomy";
import { measuredHeadToHead } from "../report/headToHead";
import { prepareActions, projectCompletedActions } from "./actions";
import { sharedRenderer } from "../crawler/renderer";
import { maybeSendChangeAlert } from "./scheduler";
import { brandPresence, type BrandPresence } from "../providers/brand";
import { ownSearchSummary } from "../google.service";
import type { GscSummary } from "../providers/searchConsole";
import { measurePageSpeed, speedUnavailable, type SpeedResult } from "../providers/pagespeed";
import { completeRun, failRun, finalizeCancelled, heartbeat, isCancelRequested, leaseUpdate, markPaidStart, type Lease } from "./dispatch";

export interface RunnerDeps {
  fetcher?: Fetcher;
  provider?: AiProvider;
  pageSpeed?: (url: string) => Promise<SpeedResult>;
  /** Own-site Search Console summary (tests inject; default reads the connected property) */
  searchSummary?: () => Promise<GscSummary>;
  /** Change alert sender for scheduled runs (tests inject) */
  sendAlert?: (runId: unknown) => Promise<unknown>;
  /** Knowledge Graph brand check (tests inject) */
  brand?: (siteName: string | null, domain: string) => Promise<BrandPresence>;
  renderer?: Renderer | null;
  now?: () => Date;
  sleep?: (ms: number) => Promise<void>;
}

interface SiteResult {
  role: "own" | "competitor";
  crawl: SiteCrawl;
  evidence: SiteEvidence;
  checks: CheckResult[];
  score: SiteScore;
  speed: SpeedResult;
  brand?: BrandPresence | null;
}

class LeaseLost extends Error {}
class Cancelled extends Error {}

export async function executeRun(lease: Lease, run: any, deps: RunnerDeps = {}): Promise<"completed" | "failed" | "cancelled" | "lost"> {
  const active = await loadActiveSettings({ fresh: true });
  return withBusinessConfig(compileBusinessConfig(active.settings), () => executeConfiguredRun(lease, run, deps, active));
}

async function executeConfiguredRun(lease: Lease, run: any, deps: RunnerDeps, active: ActiveSettings): Promise<"completed" | "failed" | "cancelled" | "lost"> {
  const cfg = analyzerConfig();
  const now = deps.now ?? (() => new Date());
  const fetcher = deps.fetcher ?? makeSafeFetcher();
  const provider = deps.provider ?? new OpenAiProvider();
  const config = run.studyConfig;
  let lost = false;
  const hb = setInterval(() => {
    heartbeat(lease)
      .then((ok) => {
        if (!ok) lost = true;
      })
      .catch(() => { lost = true; });
  }, cfg.COMPETITOR_HEARTBEAT_MS);
  const guard = async () => {
    if (lost) throw new LeaseLost();
    const r = await CompetitorRun.findById(lease.runId).select("status lease.token cancelRequestedAt").lean<any>();
    if (r?.cancelRequestedAt) throw new Cancelled();
    if (r?.status !== "running" || r?.lease?.token !== lease.token) throw new LeaseLost();
  };
  const stage = async (name: string, message: string, done?: number, total?: number) => {
    const ok = await leaseUpdate(lease, { $set: { stage: name, "progress.message": message, ...(done !== undefined ? { "progress.done": done } : {}), ...(total !== undefined ? { "progress.total": total } : {}) } });
    if (!ok) throw new LeaseLost();
  };

  const sites: { url: string; domain: string; role: "own" | "competitor" }[] = [
    { url: config.ownUrl, domain: config.ownDomain, role: "own" },
    ...config.competitors.map((c: any) => ({ url: c.url, domain: c.domain, role: "competitor" as const })),
  ];
  const results: SiteResult[] = [];
  try {
    // Admin-trained settings in force for THIS run (snapshotted: later edits never change this report).
    if (!(await leaseUpdate(lease, { $set: { settingsSnapshot: { version: active.version, source: active.source, settings: active.settings, lessons: active.lessons } } }))) throw new LeaseLost();
    await stage("reading", "Reading websites", 0, sites.length);
    // Several sites are read at the same time (each site still gets its own polite per-request delay).
    const slots: (SiteResult | undefined)[] = new Array(sites.length);
    let next = 0;
    let done = 0;
    const concurrency = Math.max(1, Math.min(4, Number(process.env.COMPETITOR_SITE_CONCURRENCY) || 3));
    const readOne = async (i: number) => {
      const s = sites[i];
      await guard();
      const crawl = await crawlSite(s.url, {
        focus: { serviceFocus: config.serviceFocus ?? [], places: config.geography?.places ?? [] },
        maxPages: Math.min(config.maxPagesPerSite ?? cfg.COMPETITOR_DEFAULT_PAGES_PER_SITE, cfg.COMPETITOR_MAX_PAGES_PER_SITE),
        fetcher,
        timeoutMs: cfg.COMPETITOR_FETCH_TIMEOUT_MS,
        maxBytes: cfg.COMPETITOR_MAX_BODY_BYTES,
        delayMs: cfg.COMPETITOR_DOMAIN_DELAY_MS,
        siteTimeoutMs: cfg.COMPETITOR_SITE_TIMEOUT_MS,
        renderer: deps.renderer === undefined ? sharedRenderer() : deps.renderer,
        userAgent: cfg.COMPETITOR_USER_AGENT,
        isCancelled: async () => lost || (await isCancelRequested(lease.runId)),
        now,
        sleep: deps.sleep,
      });
      await guard();
      const speed =
        crawl.state !== "ok"
          ? speedUnavailable("failed", "Site not read; speed not measured.", crawl.rootUrl)
          : config.settings?.pagespeed === false
            ? speedUnavailable("disabled", "PageSpeed disabled for this study.", crawl.rootUrl)
            : await (deps.pageSpeed ?? ((u: string) => measurePageSpeed(u, { enabled: cfg.COMPETITOR_PAGESPEED_ENABLED, apiKey: process.env.PAGESPEED_API_KEY || undefined })))(crawl.pages[0]?.finalUrl ?? crawl.rootUrl);
      const evidence = buildSiteEvidence(crawl, s.role);
      const checks = runChecks({ crawl, evidence, speed, now: now() }, CHECKS, active.settings.checkOverrides);
      const score = scoreSite(s.domain, checks, active.settings.categoryWeights);
      const brand = crawl.state === "ok" ? await (deps.brand ?? ((n: string | null, d: string) => brandPresence(n, d, { apiKey: process.env.GOOGLE_API_KEY || process.env.PAGESPEED_API_KEY || undefined })))(crawl.siteName, s.domain) : null;
      slots[i] = { role: s.role, crawl, evidence, checks, score, speed, brand };
      await guard();
      await CompetitorSnapshot.updateOne(
        { runId: lease.runId, domain: s.domain },
        { $set: { siteScope: SITE_SCOPE, studyId: run.studyId, role: s.role, crawl, evidence, checks, score, speed, brand } },
        { upsert: true },
      );
      done += 1;
      await stage("reading", `Read ${done} of ${sites.length} websites (latest: ${s.domain})`, done, sites.length);
    };
    const reads = await Promise.allSettled(
      Array.from({ length: Math.min(concurrency, sites.length) }, async () => {
        while (next < sites.length) {
          const i = next;
          next += 1;
          await readOne(i);
        }
      }),
    );
    const readFailure = reads.find((r): r is PromiseRejectedResult => r.status === "rejected");
    if (readFailure) throw readFailure.reason;
    results.push(...(slots.filter(Boolean) as SiteResult[]));
    await guard();

    const own = results.find((r) => r.role === "own") as SiteResult;
    const comps = results.filter((r) => r.role === "competitor");
    const quality = assessQuality(results);
    if (own.crawl.state !== "ok") {
      await failRun(lease, "OWN_SITE_UNREADABLE", `Own website could not be read: ${own.crawl.error ?? own.crawl.state}`, { quality, versions: ANALYZER_VERSIONS });
      return "failed";
    }
    if (!comps.some((c) => c.crawl.state === "ok")) {
      await failRun(lease, "NO_COMPETITOR_READABLE", "None of the competitor websites could be read.", { quality, versions: ANALYZER_VERSIONS });
      return "failed";
    }

    // ── Own Search Console (measured, own property only) ─────────────────────
    const ownSearch = await (deps.searchSummary ?? (() => ownSearchSummary(config.ownUrl)))().catch((e: Error): GscSummary => ({ state: "failed", property: null, period: null, totals: null, queries: [], pages: [], measuredAt: null, error: e.message }));

    // ── AI (optional, budgeted, validated) ──────────────────────────────────
    let ai: { status: string; model: string | null; promptVersion: string; error: string | null; dropped: number; droppedSample: unknown[]; costUsd: number | null; usageId: string | null; usage: AiUsage; outputLimit: number; grounding: string; result: ValidatedComparison | null } = {
      status: "skipped", model: null, promptVersion: COMPARISON_PROMPT_VERSION, error: null, dropped: 0, droppedSample: [], costUsd: null, usageId: null, usage: { inputTokens: null, outputTokens: null, totalTokens: null }, outputLimit: cfg.COMPETITOR_AI_MAX_OUTPUT_TOKENS, grounding: "extractive-v1", result: null,
    };
    const readiness = provider.readiness();
    if (config.settings?.ai === false) ai.error = "AI disabled for this study.";
    else if (readiness.state !== "ready") {
      ai.status = readiness.state === "disabled" ? "disabled" : "not_configured";
      ai.error = readiness.reason;
    } else {
      await stage("analysing", "AI comparison of collected evidence");
      const readable = results.filter((r) => r.crawl.state === "ok");
      // The AI narrative is publicly shareable: private Search Console data never enters this prompt.
      const prompt = buildComparisonPrompt(readable, { name: config.name, serviceFocus: config.serviceFocus, geography: config.geography?.places ?? [] }, { context: active.settings.prompts.comparisonContext, guidance: active.settings.guidance, lessons: active.lessons.comparison });
      const res = await budgetedCall(provider, { task: "comparison", promptVersion: COMPARISON_PROMPT_VERSION, system: prompt.system, user: prompt.user, schemaName: "moksha_competitor_comparison", schema: COMPARISON_SCHEMA as any, maxOutputTokens: ai.outputLimit }, { runId: lease.runId, studyId: run.studyId, onPaidStart: () => markPaidStart(lease) });
      if (!(await leaseUpdate(lease, { $set: { paidFinishedAt: now() } }))) throw new LeaseLost();
      ai = { ...ai, model: res.model, costUsd: res.costUsd, usageId: res.usageId, usage: res.usage };
      if (res.ok) {
        const v = validateComparison(res.data, new SourceSet(prompt.sources), { own: own.evidence.domain, competitors: comps.map((c) => c.evidence.domain) });
        ai = { ...ai, status: v.dropped.length ? "validated_with_drops" : "validated", result: v.result, dropped: v.dropped.length, droppedSample: v.dropped.slice(0, 40) };
      } else {
        ai = { ...ai, status: res.budgetBlocked ? "budget_blocked" : res.errorClass === "uncertain" ? "uncertain" : res.errorClass === "invalid_output" ? "invalid_output" : "failed", error: res.error };
      }
    }
    await guard();

    // ── Changes vs previous successful run ─────────────────────────────────
    await stage("saving", "Comparing with previous run and saving report");
    const study = await CompetitorStudy.findById(run.studyId).select("latestSuccessfulRunId").lean<any>();
    let changes: { domain: string; previousRunId: string; diff: SiteDiff }[] | null = null;
    if (study?.latestSuccessfulRunId && String(study.latestSuccessfulRunId) !== String(lease.runId)) {
      const prev = await CompetitorSnapshot.find({ runId: study.latestSuccessfulRunId }).lean<any[]>();
      changes = results
        .map((r) => {
          const p = prev.find((x) => x.domain === r.evidence.domain);
          return p ? { domain: r.evidence.domain, previousRunId: String(study.latestSuccessfulRunId), diff: diffSnapshots(p, r) } : null;
        })
        .filter((x): x is NonNullable<typeof x> => !!x);
    }

    const scores = results.map((r) => r.score);
    const scopes = comps.map((c) => scopeComparison(own.evidence, c.evidence));
    const actionProjection = await prepareActions(run.studyId, lease.runId, own.checks, ai.result);
    const report = {
      studyName: config.name,
      actions: actionProjection.actions,
      actionPlan: actionProjection.plan,
      generatedAt: now().toISOString(),
      scope: { own: own.evidence.domain, competitors: comps.map((c) => c.evidence.domain), serviceFocus: config.serviceFocus, geography: config.geography, maxPagesPerSite: config.maxPagesPerSite },
      pageComparisons: matchingPages(results, config.serviceFocus ?? [], config.geography?.places ?? []),
      sites: results.map((r) => ({
        domain: r.evidence.domain,
        role: r.role,
        siteName: r.evidence.siteName,
        rootUrl: r.crawl.rootUrl,
        crawlState: r.crawl.state,
        crawlError: r.crawl.error,
        coverage: r.crawl.coverage,
        robots: r.crawl.robots,
        sitemap: { found: r.crawl.sitemap.found, entryCount: r.crawl.sitemap.entryCount, latestLastmod: r.crawl.sitemap.latestLastmod, recent30: r.crawl.sitemap.recent30 ?? null, recent90: r.crawl.sitemap.recent90 ?? null },
        newestContentDate: r.crawl.pages.map((p) => p.extract?.latestDate).filter((d): d is string => !!d).sort().slice(-1)[0] ?? null,
        upClose: upClose(r),
        brand: r.brand ?? null,
        hasScreenshot: !!r.speed.screenshot,
        socials: [...new Map(r.crawl.pages.flatMap((p) => p.extract?.socialLinks ?? []).map((x) => [x.platform + "|" + x.href.replace(/\/+$/, ""), x])).values()].slice(0, 12),
        score: r.score,
        checkCounts: countStates(r.checks),
        speed: { state: r.speed.state, mobile: r.speed.mobile, field: r.speed.field, error: r.speed.error, measuredAt: r.speed.measuredAt },
        services: r.evidence.services,
        prices: r.evidence.prices.slice(0, 30),
        features: r.evidence.features,
        places: r.evidence.places,
        metrics: r.evidence.metrics,
      })),
      ownSearch: { state: ownSearch.state, property: ownSearch.property, period: ownSearch.period, totals: ownSearch.totals, queries: ownSearch.queries.slice(0, 50), pages: ownSearch.pages.slice(0, 25), measuredAt: ownSearch.measuredAt, error: ownSearch.error },
      leaders: categoryLeaders(scores),
      scopes,
      overallComparable: scopes.length > 0 && scopes.every((s) => s.comparable),
      ai: { ...ai, publicSafe: true },
      changes,
      quality,
      methodology: {
        rubricVersion: ANALYZER_VERSIONS.rubric,
        checksVersion: ANALYZER_VERSIONS.checks,
        checkCount: CHECKS.length,
        settingsVersion: active.version,
        settingsSource: active.source,
        categoryWeights: active.settings.categoryWeights,
        checkOverrides: active.settings.checkOverrides,
        lessonsUsed: active.lessons.comparison.length,
        weights: "Quality rubric v2; external calibration pending",
        calibration: own.score.calibration,
        rules: ["Unknown is not zero: unknown/not-applicable checks are excluded from scores.", "A category is scored only with ≥50% evaluable check weight; overall only with ≥70% of rubric weight scored.", "Measured website score only — not business performance, market share, ranking or service quality.", "Crawl is a bounded sample of prioritised public pages."],
      },
      limitations: buildLimitations(results, ai.status),
    };
    const savedReport = { ...report, measuredHeadToHead: measuredHeadToHead(report.sites) };

    await guard();
    const ok = await completeRun(lease, { report: savedReport, quality, ai: { status: ai.status, model: ai.model, promptVersion: ai.promptVersion, error: ai.error, dropped: ai.dropped, costUsd: ai.costUsd, usage: ai.usage, outputLimit: ai.outputLimit }, versions: ANALYZER_VERSIONS, "progress.message": "Done" });
    if (!ok) {
      const r = await CompetitorRun.findById(lease.runId).select("cancelRequestedAt status").lean<any>();
      if (r?.cancelRequestedAt && r.status === "running") {
        await finalizeCancelled(lease, { quality });
        return "cancelled";
      }
      return "lost";
    }
    // Only move the "latest successful" pointer forward (a slower older run must not overwrite a newer one).
    await CompetitorStudy.updateOne({ _id: run.studyId, $or: [{ latestSuccessfulRunId: null }, { latestSuccessfulRunId: { $lt: lease.runId } }] }, { $set: { latestSuccessfulRunId: lease.runId } });
    await projectCompletedActions(lease.runId).catch((e: Error) => logger.warn(`[competitor-analyzer] action projection pending recovery: ${e.message}`));
    if (run.trigger === "scheduled") await (deps.sendAlert ?? maybeSendChangeAlert)(lease.runId).catch((e: Error) => logger.warn(`[competitor-analyzer] alert failed: ${e.message}`));
    return "completed";
  } catch (e) {
    if (e instanceof Cancelled) {
      await finalizeCancelled(lease, { quality: results.length ? assessQuality(results) : null });
      return "cancelled";
    }
    if (e instanceof LeaseLost) return "lost";
    logger.error(`[competitor-analyzer] run ${String(lease.runId)} failed: ${(e as Error).stack ?? e}`);
    await failRun(lease, "RUN_ERROR", (e as Error).message ?? "Unexpected error");
    return "failed";
  } finally {
    clearInterval(hb);
  }
}

function countStates(checks: CheckResult[]) {
  const out = { pass: 0, warn: 0, fail: 0, unknown: 0, not_applicable: 0 };
  for (const c of checks) out[c.state] += 1;
  return out;
}

export function assessQuality(results: (Pick<SiteResult, "role" | "crawl"> & Partial<Pick<SiteResult, "speed" | "brand">>)[]) {
  const issues: { severity: "error" | "warning"; domain: string; code: string; message: string; nextStep?: string; urls?: string[] }[] = [];
  for (const r of results) {
    if (r.crawl.state !== "ok") issues.push({ severity: r.role === "own" ? "error" : "warning", domain: r.crawl.domain, code: `site_${r.crawl.state}`, message: r.crawl.error ?? `Site ${r.crawl.state}` });
    else {
      if (r.crawl.coverage.status !== "complete") issues.push({ severity: r.crawl.coverage.status === "insufficient" ? "error" : "warning", domain: r.crawl.domain, code: "coverage_" + r.crawl.coverage.status, message: `Coverage ${r.crawl.coverage.status}: missing ${r.crawl.coverage.missingPriorityKinds.join(", ") || "none"}; ${r.crawl.coverage.warnings.join(" ")}`.trim() });
      if (r.crawl.coverage.jsShellPages) issues.push({ severity: "warning", domain: r.crawl.domain, code: "js_rendering", message: `${r.crawl.coverage.jsShellPages} page(s) need JavaScript rendering.` });
      const failed = r.crawl.pages.filter((p) => !["read", "robots_disallowed"].includes(p.state));
      if (failed.length) issues.push({ severity: "warning", domain: r.crawl.domain, code: "failed_pages", message: `${failed.length} selected page(s) failed.`, urls: failed.map((p) => p.url).slice(0, 10), nextStep: "Open these URLs and check their HTTP response. Re-check after availability is restored." });
    }
    if (r.speed && !["measured", "disabled"].includes(r.speed.state)) issues.push({ severity: "warning", domain: r.crawl.domain, code: "pagespeed_unavailable", message: r.speed.error ?? "Mobile lab measurement unavailable.", nextStep: "Check PageSpeed provider health and quota, then re-check. Missing speed is excluded from scores." });
    if (r.brand?.state === "unavailable") issues.push({ severity: "warning", domain: r.crawl.domain, code: "brand_unavailable", message: r.brand.error ?? "Brand verification unavailable.", nextStep: "Check Knowledge Graph API access in provider settings. Website content remains available." });
  }
  const errors = issues.filter((i) => i.severity === "error").length;
  for (const issue of issues) issue.nextStep ??= issue.code.startsWith("coverage_") ? "Review missing page types in Each Website. Adjust the study page budget or target scope, then re-check; a missing page type may not exist on this website."
    : issue.code === "js_rendering" ? "Enable the browser renderer and re-check the affected pages."
    : "Review the website response and robots rules. Re-check when it becomes readable; respect disallowed paths.";
  const completeness = results.length ? Math.round(results.reduce((sum, r) => {
    const c = r.crawl.coverage;
    const readable = c.selected ? Math.min(1, c.read / c.selected) : 0;
    const breadth = Math.max(0, 1 - c.missingPriorityKinds.length / 5);
    return sum + (r.crawl.state === "ok" ? 0.7 * readable + 0.3 * breadth : 0);
  }, 0) / results.length * 100) : 0;
  return { status: errors ? "needs_review" : issues.length ? "partial" : "verified", issues, completeness, rule: "Sample coverage = 70% selected-page read rate + 30% coverage of five core page types, averaged across sites. Provider availability is shown separately. This is not an accuracy probability." };
}

function buildLimitations(results: SiteResult[], aiStatus: string) {
  const out = ["Each site was read as a bounded sample of prioritised public pages, not a full crawl.", "No search rankings, search volume, traffic or Maps positions are measured or estimated."];
  if (results.some((r) => r.speed.state !== "measured")) out.push("PageSpeed data is unavailable for some sites; performance scores for them are not computed.");
  if (results.some((r) => r.crawl.coverage.jsShellPages)) out.push("Some pages need JavaScript rendering, which was not available; their content is not observed.");
  if (!["validated", "validated_with_drops"].includes(aiStatus)) out.push(`AI analysis status: ${aiStatus}. Measured evidence and deterministic scores are still shown.`);
  return out;
}

/** Compact "website up close" facts for the report (all measured from the read pages). */
function upClose(r: SiteResult) {
  const read = r.crawl.pages.filter((p) => p.state === "read" && p.extract);
  const home = read.find((p) => p.kind === "home")?.extract ?? null;
  const imgs = read.reduce((a, p) => ({ total: a.total + p.extract!.images.total, alt: a.alt + p.extract!.images.withAlt }), { total: 0, alt: 0 });
  return {
    pagesRead: read.length,
    words: read.reduce((s, p) => s + p.extract!.wordCount, 0),
    images: imgs.total,
    imagesWithAlt: imgs.alt,
    titleLength: home?.title?.length ?? null,
    descriptionLength: home?.metaDescription?.length ?? null,
    h1Count: home?.h1Count ?? null,
    https: r.crawl.https,
    openGraph: home ? !!(home.og.title && home.og.image) : null,
    viewport: home?.viewport ?? null,
    lang: home?.lang ?? null,
    schemaTypes: r.evidence.metrics.schemaTypes.slice(0, 10),
    ctas: r.evidence.metrics.distinctCtas.slice(0, 8),
    pageKinds: [...new Set(read.map((p) => p.kind))],
  };
}
