import { Types } from "mongoose";
import { CompetitorAction, CompetitorCandidate, CompetitorKeyword, CompetitorRun, CompetitorSnapshot, CompetitorStudy, CompetitorUsage, CompetitorWorker, SITE_SCOPE } from "../../models/competitorAnalyzer";
import { logger } from "../../utils/logger";
import { diffSnapshots } from "./analysis/changes";
import { buildKeywordRecord, headingKeywords, matchPages } from "./analysis/keywords";
import { budgetedCall, budgetStatus } from "./ai/budget";
import { buildDiscoveryPrompt, buildKeywordPrompt, DISCOVERY_PROMPT_VERSION, DISCOVERY_SCHEMA, KEYWORD_PROMPT_VERSION, KEYWORD_SCHEMA } from "./ai/prompts";
import { OpenAiProvider, lastAiError, type AiProvider } from "./ai/provider";
import { analyzerConfig } from "./config";
import { crawlSite } from "./crawler/crawler";
import { servicesInText } from "./crawler/extract";
import { makeSafeFetcher, resolvePublicAddress, type Fetcher, type SafeFetchDeps } from "./crawler/safeFetch";
import { normalizePageUrl, normalizeSite } from "./crawler/url";
import { AnalyzerError, FetchBlockedError } from "./errors";
import { claimRun } from "./jobs/dispatch";
import { queueReady, signalRunQueued } from "./jobs/worker";
import { nextDueAt, nextReportAt, schedulerEnabled, schedulerRunning } from "./jobs/scheduler";
import { browserExecutable, renderingEnabled } from "./crawler/renderer";
import { loadActiveSettings, recordFeedback } from "./settings";
import { googleStatus } from "./google.service";
import { buildSiteEvidence } from "./evidence/evidence";
import { sharedRenderer } from "./crawler/renderer";
import { withMeasuredComparison } from "./report/headToHead";

/* Service layer. Every query is scoped to SITE_SCOPE (server-resolved); ids from the client are never trusted alone. */

export interface ServiceDeps {
  provider: AiProvider;
  fetcher: Fetcher;
  /** DNS public-address check for competitor URLs (tests inject a stub). */
  dns: SafeFetchDeps;
}

let deps: ServiceDeps = { provider: new OpenAiProvider(), fetcher: makeSafeFetcher(), dns: {} };
export const setServiceDeps = (d: Partial<ServiceDeps>) => {
  deps = { ...deps, ...d };
};
export const getServiceDeps = () => deps;

// ── Studies ────────────────────────────────────────────────────────────────────
async function normalizeCompetitors(ownDomain: string, input: (string | { url: string; name?: string })[]) {
  const cfg = analyzerConfig();
  const out: { url: string; domain: string; name: string | null }[] = [];
  for (const item of input) {
    const raw = typeof item === "string" ? item : item.url;
    const site = normalizeSite(raw);
    if (!site) throw new AnalyzerError(400, "INVALID_URL", `Not a valid public website address: ${String(raw).slice(0, 100)}`);
    if (site.domain === ownDomain) throw new AnalyzerError(400, "OWN_DOMAIN_AS_COMPETITOR", `${site.domain} is your own website and cannot be a competitor`);
    if (out.some((c) => c.domain === site.domain)) throw new AnalyzerError(400, "DUPLICATE_DOMAIN", `${site.domain} is listed more than once`);
    try {
      await resolvePublicAddress(new URL(site.url).hostname, deps.dns);
    } catch (e) {
      if (e instanceof FetchBlockedError) throw new AnalyzerError(400, "BLOCKED_TARGET", `${site.domain}: ${e.message}`);
      throw e;
    }
    out.push({ ...site, name: typeof item === "string" ? null : (item.name ?? null) });
  }
  if (out.length > cfg.COMPETITOR_MAX_COMPETITORS) throw new AnalyzerError(400, "TOO_MANY_COMPETITORS", `At most ${cfg.COMPETITOR_MAX_COMPETITORS} competitors per study`);
  return out;
}

function ownSite(ownUrl?: string) {
  const site = normalizeSite(ownUrl ?? analyzerConfig().primarySiteUrl);
  if (!site) throw new AnalyzerError(400, "INVALID_URL", "Own website address is invalid");
  return site;
}

export async function createStudy(body: any, by: string | null) {
  const cfg = analyzerConfig();
  const active = await CompetitorStudy.countDocuments({ siteScope: SITE_SCOPE, status: "active" });
  if (active >= cfg.COMPETITOR_MAX_ACTIVE_STUDIES) throw new AnalyzerError(409, "STUDY_LIMIT", `At most ${cfg.COMPETITOR_MAX_ACTIVE_STUDIES} active studies`);
  const own = ownSite(body.ownUrl);
  const competitors = await normalizeCompetitors(own.domain, body.competitors ?? []);
  const doc = await CompetitorStudy.create({
    siteScope: SITE_SCOPE,
    name: body.name,
    ownUrl: own.url,
    ownDomain: own.domain,
    competitors,
    serviceFocus: body.serviceFocus ?? [],
    geography: body.geography,
    goal: body.goal ?? "",
    maxPagesPerSite: Math.min(body.maxPagesPerSite ?? cfg.COMPETITOR_DEFAULT_PAGES_PER_SITE, cfg.COMPETITOR_MAX_PAGES_PER_SITE),
    settings: { schedule: body.settings?.schedule ?? "off", alerts: body.settings?.alerts ?? false, pagespeed: body.settings?.pagespeed ?? true, ai: body.settings?.ai ?? true, alertEmails: body.settings?.alertEmails ?? [], monthlyReport: body.settings?.monthlyReport ?? false },
    nextScheduledAt: nextDueAt(body.settings?.schedule ?? "off"),
    nextReportAt: body.settings?.monthlyReport ? nextReportAt() : null,
    createdBy: by,
    updatedBy: by,
  });
  return doc.toObject();
}

export async function updateStudy(id: string, body: any, by: string | null) {
  const cfg = analyzerConfig();
  const current = await CompetitorStudy.findOne({ _id: id, siteScope: SITE_SCOPE }).lean<any>();
  if (!current) throw new AnalyzerError(404, "STUDY_NOT_FOUND", "Study not found");
  if (current.status === "archived") throw new AnalyzerError(409, "STUDY_ARCHIVED", "Archived studies cannot be edited");
  const set: Record<string, unknown> = { updatedBy: by };
  const own = body.ownUrl !== undefined ? ownSite(body.ownUrl) : { url: current.ownUrl, domain: current.ownDomain };
  if (body.ownUrl !== undefined) Object.assign(set, { ownUrl: own.url, ownDomain: own.domain });
  if (body.competitors !== undefined || body.ownUrl !== undefined) set.competitors = await normalizeCompetitors(own.domain, body.competitors ?? current.competitors);
  for (const k of ["name", "serviceFocus", "geography", "goal"]) if (body[k] !== undefined) set[k] = body[k];
  if (body.maxPagesPerSite !== undefined) set.maxPagesPerSite = Math.min(body.maxPagesPerSite, cfg.COMPETITOR_MAX_PAGES_PER_SITE);
  if (body.settings) for (const [k, v] of Object.entries(body.settings)) if (v !== undefined) set[`settings.${k}`] = v;
  // Schedule changed → next due slot recalculated from now (off clears it).
  if (body.settings?.schedule !== undefined && body.settings.schedule !== current.settings?.schedule) set.nextScheduledAt = nextDueAt(body.settings.schedule);
  if (body.settings?.monthlyReport !== undefined && body.settings.monthlyReport !== current.settings?.monthlyReport) set.nextReportAt = body.settings.monthlyReport ? nextReportAt() : null;
  const updated = await CompetitorStudy.findOneAndUpdate({ _id: id, siteScope: SITE_SCOPE, revision: body.expectedRevision, status: "active" }, { $set: set, $inc: { revision: 1 } }, { returnDocument: "after" }).lean<any>();
  if (!updated) throw new AnalyzerError(409, "REVISION_CONFLICT", "The study was changed by someone else; reload and try again");
  return updated;
}

export async function archiveStudy(id: string, by: string | null) {
  const active = await CompetitorRun.findOne({ activeKey: id }).lean<any>();
  if (active) throw new AnalyzerError(409, "RUN_ACTIVE", "Stop the running analysis before archiving");
  const res = await CompetitorStudy.findOneAndUpdate({ _id: id, siteScope: SITE_SCOPE }, { $set: { status: "archived", archivedAt: new Date(), updatedBy: by } }, { returnDocument: "after" }).lean<any>();
  if (!res) throw new AnalyzerError(404, "STUDY_NOT_FOUND", "Study not found");
  return res;
}

export async function restoreStudy(id: string, by: string | null) {
  const study = await CompetitorStudy.findOne({ _id: id, siteScope: SITE_SCOPE }).lean<any>();
  if (!study) throw new AnalyzerError(404, "STUDY_NOT_FOUND", "Study not found");
  if (study.status === "active") return study;
  if (await CompetitorStudy.countDocuments({ siteScope: SITE_SCOPE, status: "active" }) >= analyzerConfig().COMPETITOR_MAX_ACTIVE_STUDIES) throw new AnalyzerError(409, "STUDY_LIMIT", "Active study limit reached");
  return CompetitorStudy.findOneAndUpdate({ _id: id, siteScope: SITE_SCOPE, status: "archived" }, { $set: { status: "active", archivedAt: null, updatedBy: by, nextScheduledAt: nextDueAt(study.settings?.schedule ?? "off"), nextReportAt: study.settings?.monthlyReport ? nextReportAt() : null }, $inc: { revision: 1 } }, { returnDocument: "after" }).lean<any>();
}

const RUN_SUMMARY = "status stage progress trigger configRevision attempts startedAt finishedAt createdAt error quality ai.status ai.error cancelRequestedAt";

export async function listStudies(q: { status?: string; page?: number; limit?: number; q?: string }) {
  const filter: Record<string, unknown> = { siteScope: SITE_SCOPE };
  if (q.status !== "all") filter.status = q.status ?? "active";
  if (q.q) filter.name = { $regex: q.q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), $options: "i" };
  const limit = q.limit ?? 20;
  const page = q.page ?? 1;
  const [items, total] = await Promise.all([CompetitorStudy.find(filter).sort({ updatedAt: -1 }).skip((page - 1) * limit).limit(limit).lean<any[]>(), CompetitorStudy.countDocuments(filter)]);
  const runIds = items.flatMap((s) => [s.latestRunId, s.latestSuccessfulRunId]).filter(Boolean);
  const runs = await CompetitorRun.find({ _id: { $in: runIds } }).select(`${RUN_SUMMARY} report.quality report.sites.domain report.sites.role report.sites.score.overall`).lean<any[]>();
  const byId = new Map(runs.map((r) => [String(r._id), r]));
  return {
    items: items.map((s) => ({ ...s, latestRun: s.latestRunId ? (byId.get(String(s.latestRunId)) ?? null) : null, latestSuccessfulRun: s.latestSuccessfulRunId ? (byId.get(String(s.latestSuccessfulRunId)) ?? null) : null })),
    total,
    page,
    limit,
  };
}

export async function getStudy(id: string) {
  const study = await CompetitorStudy.findOne({ _id: id, siteScope: SITE_SCOPE }).lean<any>();
  if (!study) throw new AnalyzerError(404, "STUDY_NOT_FOUND", "Study not found");
  const [latestRun, latestSuccessfulRun] = await Promise.all([
    study.latestRunId ? CompetitorRun.findById(study.latestRunId).select(RUN_SUMMARY).lean() : null,
    study.latestSuccessfulRunId ? CompetitorRun.findById(study.latestSuccessfulRunId).lean() : null,
  ]);
  return { study, latestRun, latestSuccessfulRun };
}

// ── Runs ──────────────────────────────────────────────────────────────────────
export async function startRun(id: string, body: { idempotencyKey?: string }, by: string | null) {
  if (!analyzerConfig().COMPETITOR_ANALYZER_ENABLED) throw new AnalyzerError(503, "ANALYZER_DISABLED", "Competitor analyzer is disabled");
  const { run, reused } = await claimRun(id, { trigger: "manual", idempotencyKey: body.idempotencyKey ?? null, by });
  if (!reused) void signalRunQueued(String(run._id));
  return { runId: String(run._id), status: run.status, stage: run.stage, reused };
}

export async function listRuns(id: string, q: { page?: number; limit?: number }) {
  await assertStudy(id);
  const limit = q.limit ?? 20;
  const page = q.page ?? 1;
  const [items, total] = await Promise.all([
    CompetitorRun.find({ studyId: id, siteScope: SITE_SCOPE }).select(`${RUN_SUMMARY} report.sites.domain report.sites.score.overall report.sites.score.rubricVersion report.sites.role report.methodology.rubricVersion`).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    CompetitorRun.countDocuments({ studyId: id, siteScope: SITE_SCOPE }),
  ]);
  return { items, total, page, limit };
}

export async function getRun(id: string, runId: string) {
  const run = await CompetitorRun.findOne({ _id: runId, studyId: id, siteScope: SITE_SCOPE }).select("-lease.token").lean<any>();
  if (!run) throw new AnalyzerError(404, "RUN_NOT_FOUND", "Run not found");
  if (run.report) run.report = withMeasuredComparison(run.report);
  if (run.report?.ai && !run.report.ai.usage) {
    const usage = await CompetitorUsage.findOne({ runId: run._id, studyId: id, siteScope: SITE_SCOPE, task: "comparison" }).sort({ createdAt: -1 }).select("inputTokens outputTokens estimatedCostUsd").lean<any>();
    if (usage) run.report.ai = { ...run.report.ai, usage: { inputTokens: usage.inputTokens ?? null, outputTokens: usage.outputTokens ?? null, totalTokens: usage.inputTokens != null && usage.outputTokens != null ? usage.inputTokens + usage.outputTokens : null }, costUsd: usage.estimatedCostUsd ?? null };
  }
  return run;
}

export async function getSnapshot(id: string, runId: string, domain: string) {
  const snap = await CompetitorSnapshot.findOne({ runId, studyId: id, domain: domain.toLowerCase(), siteScope: SITE_SCOPE }).lean<any>();
  if (!snap) throw new AnalyzerError(404, "RUN_NOT_FOUND", "Snapshot not found");
  return snap;
}

export async function compareRuns(id: string, from: string, to: string) {
  await assertStudy(id);
  const [a, b] = await Promise.all([CompetitorSnapshot.find({ runId: from, studyId: id }).lean<any[]>(), CompetitorSnapshot.find({ runId: to, studyId: id }).lean<any[]>()]);
  if (!a.length || !b.length) throw new AnalyzerError(404, "RUN_NOT_FOUND", "One of the runs has no saved snapshots");
  return b.map((curr) => {
    const prev = a.find((x) => x.domain === curr.domain);
    return { domain: curr.domain, diff: prev ? diffSnapshots(prev, curr) : { comparable: false, reason: "Site not present in the earlier run", changes: [], notComparable: [] } };
  });
}

export async function exportRun(id: string, runId: string) {
  const run = await getRun(id, runId);
  if (!run.report) throw new AnalyzerError(409, "RUN_NOT_FOUND", "This run has no completed report");
  // Canonical saved data only; no regeneration, no internal lease/usage ids.
  return { exportedAt: new Date().toISOString(), runId, studyId: id, finishedAt: run.finishedAt, studyConfig: run.studyConfig, versions: run.versions, report: { ...run.report, ai: run.report.ai ? { ...run.report.ai, usageId: undefined } : null } };
}

async function assertStudy(id: string) {
  const s = await CompetitorStudy.exists({ _id: id, siteScope: SITE_SCOPE });
  if (!s) throw new AnalyzerError(404, "STUDY_NOT_FOUND", "Study not found");
}

// ── Discovery / candidates ────────────────────────────────────────────────────
export async function verifyCandidate(candidateId: string) {
  const c = await CompetitorCandidate.findOne({ _id: candidateId, siteScope: SITE_SCOPE }).lean<any>();
  if (!c) throw new AnalyzerError(404, "STUDY_NOT_FOUND", "Candidate not found");
  const cfg = analyzerConfig();
  const crawl = await crawlSite(c.url, { maxPages: 1, fetcher: deps.fetcher, timeoutMs: Math.min(cfg.COMPETITOR_FETCH_TIMEOUT_MS, 10_000), maxBytes: cfg.COMPETITOR_MAX_BODY_BYTES, delayMs: 0, siteTimeoutMs: 30_000, skipSitemap: true, userAgent: cfg.COMPETITOR_USER_AGENT });
  const home = crawl.pages.find((p) => p.kind === "home");
  const services = home?.extract ? servicesInText(`${home.extract.title ?? ""} ${home.extract.headings.map((h) => h.text).join(" ")} ${home.extract.text}`) : [];
  const state =
    crawl.state === "ok" ? (services.length ? "verified" : "no_service_match")
      : crawl.state === "redirected_offsite" ? "redirected"
        : crawl.state === "robots_disallowed" ? "robots_disallowed"
          : crawl.state === "blocked" ? "blocked" : "unreachable";
  const issues = [crawl.error, ...crawl.coverage.warnings].filter((x): x is string => !!x).slice(0, 5);
  const update: Record<string, unknown> = { verification: { state, checkedAt: new Date(), siteName: crawl.siteName, finalUrl: home?.finalUrl ?? crawl.movedTo ?? null, servicesMatched: services, issues } };
  // Uncertain identity / no service evidence → human review, whatever the AI said.
  if (state !== "verified" && c.classification !== "unrelated") update.classification = "needs_review";
  return CompetitorCandidate.findOneAndUpdate({ _id: c._id }, { $set: update }, { returnDocument: "after" }).lean();
}

async function upsertCandidate(input: { url: string; businessName?: string | null; discovery: Record<string, unknown>; classification?: string; relevance?: string; claimedGeography?: string[]; matchingServices?: string[]; notes?: string; watchlisted?: boolean }) {
  const site = normalizeSite(input.url);
  if (!site) throw new AnalyzerError(400, "INVALID_URL", "Not a valid public website address");
  const own = ownSite().domain;
  if (site.domain === own) throw new AnalyzerError(400, "OWN_DOMAIN_AS_COMPETITOR", "That is your own website");
  const res = await CompetitorCandidate.findOneAndUpdate(
    { siteScope: SITE_SCOPE, domain: site.domain },
    {
      $setOnInsert: { siteScope: SITE_SCOPE, domain: site.domain, url: site.url, classification: input.classification ?? "needs_review", relevance: input.relevance ?? "", claimedGeography: input.claimedGeography ?? [], matchingServices: input.matchingServices ?? [], ...(input.notes ? { notes: input.notes } : {}) },
      $push: { discoveries: { $each: [input.discovery], $slice: -30 } },
      ...(input.businessName || input.watchlisted !== undefined ? { $set: { ...(input.businessName ? { businessName: input.businessName } : {}), ...(input.watchlisted !== undefined ? { watchlisted: input.watchlisted } : {}) } } : {}),
    },
    { upsert: true, returnDocument: "after", includeResultMetadata: true },
  );
  return { candidate: res.value, created: !res.lastErrorObject?.updatedExisting };
}

export async function addCandidate(body: { url: string; businessName?: string; notes?: string; watchlisted?: boolean }, by: string | null) {
  const { candidate, created } = await upsertCandidate({ url: body.url, businessName: body.businessName ?? null, notes: body.notes, watchlisted: body.watchlisted, discovery: { source: "manual", keyword: null, location: null, citations: [], citationsVerified: false, discoveredAt: new Date(), by } });
  const verified = await verifyCandidate(String(candidate._id)).catch((e) => {
    logger.warn(`[competitor-analyzer] verify failed: ${(e as Error).message}`);
    return candidate;
  });
  return { candidate: verified, created };
}

export async function discoverCandidates(body: { keywords: string[]; location: string; serviceCategory?: string; language: string; intent?: string }, by: string | null, opts: { backgroundVerify?: boolean } = {}) {
  const ready = deps.provider.readiness();
  if (ready.state !== "ready" || !ready.webSearch) {
    throw new AnalyzerError(503, "PROVIDER_UNAVAILABLE", `AI web research unavailable: ${ready.reason ?? (ready.webSearch ? "" : "COMPETITOR_AI_WEB_SEARCH_ENABLED is off")}. Add competitors manually instead.`);
  }
  const own = ownSite().domain;
  const existing = (await CompetitorCandidate.find({ siteScope: SITE_SCOPE, status: "rejected" }).select("domain").lean<any[]>()).map((c) => c.domain);
  const active = await loadActiveSettings();
  const prompt = buildDiscoveryPrompt({ keywords: body.keywords, location: body.location, serviceCategory: body.serviceCategory ?? null, language: body.language, intent: body.intent ?? null, exclude: [own, ...existing].slice(0, 50) }, { context: active.settings.prompts.discoveryContext, guidance: active.settings.guidance, lessons: active.lessons.discovery });
  const res = await budgetedCall(deps.provider, { task: "discovery", promptVersion: DISCOVERY_PROMPT_VERSION, system: prompt.system, user: prompt.user, schemaName: "competitor_discovery", schema: DISCOVERY_SCHEMA as any, webSearch: true, maxOutputTokens: 4_000 }, {});
  if (!res.ok) throw new AnalyzerError(res.budgetBlocked ? 402 : 502, res.budgetBlocked ? "AI_BUDGET_EXCEEDED" : "AI_UNAVAILABLE", res.error ?? "AI discovery failed");
  const cited = new Set(res.citations.map((u) => normalizePageUrl(u)).filter(Boolean) as string[]);
  const rejected: { url: string; reason: string }[] = [];
  const saved: unknown[] = [];
  const raw = Array.isArray((res.data as any)?.candidates) ? (res.data as any).candidates.slice(0, 15) : [];
  for (const c of raw) {
    const site = normalizeSite(c?.websiteUrl);
    if (!site) {
      rejected.push({ url: String(c?.websiteUrl).slice(0, 120), reason: "Invalid website URL" });
      continue;
    }
    if (site.domain === own) {
      rejected.push({ url: site.url, reason: "Own domain" });
      continue;
    }
    if (existing.includes(site.domain)) {
      rejected.push({ url: site.url, reason: "Rejected by the team" });
      continue;
    }
    const sources = (Array.isArray(c.sourceUrls) ? c.sourceUrls : []).map((u: unknown) => normalizePageUrl(String(u))).filter(Boolean) as string[];
    const verifiedSources = sources.filter((u) => cited.has(u));
    const { candidate } = await upsertCandidate({
      url: site.url,
      businessName: typeof c.businessName === "string" ? c.businessName.slice(0, 160) : null,
      classification: typeof c.category === "string" ? c.category : "needs_review",
      relevance: typeof c.relevance === "string" ? c.relevance.slice(0, 500) : "",
      claimedGeography: Array.isArray(c.claimedGeography) ? c.claimedGeography.slice(0, 10).map((x: unknown) => String(x).slice(0, 80)) : [],
      matchingServices: Array.isArray(c.matchingServices) ? c.matchingServices.slice(0, 10).map((x: unknown) => String(x).slice(0, 80)) : [],
      discovery: { source: "openai_web_search", keyword: body.keywords.join(" | "), location: body.location, citations: verifiedSources.length ? verifiedSources : sources.slice(0, 5), citationsVerified: verifiedSources.length > 0, discoveredAt: new Date(), by },
    });
    saved.push(candidate);
  }
  // Verify each saved domain with our own crawler (bounded, background). Results are visible on the candidate list.
  if (opts.backgroundVerify !== false) {
    void (async () => {
      for (const c of saved as any[]) await verifyCandidate(String(c._id)).catch(() => undefined);
    })();
  }
  return { candidates: saved, rejected, citationsReturned: res.citations.length, note: "Discovery order is not a search ranking. Candidates are verified by our crawler in the background; uncertain matches need manual review." };
}

/*
 * One-click discovery from a website address (default: our own site).
 *   1. read the site with our crawler (bounded sample) → services it offers + places it names + its name
 *   2. build search queries automatically (top services × main place, + "businesses like <name>")
 *   3. OpenAI web search finds candidates (citations checked), 4. our crawler verifies every domain now
 *   5. rank: verified → direct competitor → most shared services; return the top picks + everything found
 * Nothing is invented: services/places come from the crawled pages, candidates from cited web results.
 */
export async function autoDiscover(body: { url?: string; location?: string; max?: number }, by: string | null) {
  const cfg = analyzerConfig();
  const site = ownSite(body.url);
  const crawl = await crawlSite(site.url, { maxPages: 6, fetcher: deps.fetcher, timeoutMs: cfg.COMPETITOR_FETCH_TIMEOUT_MS, maxBytes: cfg.COMPETITOR_MAX_BODY_BYTES, delayMs: 200, siteTimeoutMs: 60_000, renderer: sharedRenderer(), userAgent: cfg.COMPETITOR_USER_AGENT });
  if (crawl.state !== "ok") throw new AnalyzerError(422, "OWN_DOMAIN_AS_COMPETITOR", `Could not read ${site.domain}: ${crawl.error ?? crawl.state}`);
  const evidence = buildSiteEvidence(crawl, "own");
  const services = evidence.services.filter((s) => s.state === "present");
  // Places ordered by how many read pages mention them (most-mentioned = main market).
  const places = evidence.places.map((p) => ({ place: p.place, n: p.evidence.length })).sort((a, b) => b.n - a.n).map((p) => p.place);
  const location = body.location?.trim() || (places.length ? places.slice(0, 3).join(", ") : "India");
  const mainPlace = body.location?.trim() || places[0] || "India";
  const topServices = services.slice(0, 3).map((s) => s.label.toLowerCase());
  const keywords = [...topServices.map((s) => `${s} in ${mainPlace}`), ...(crawl.siteName ? [`businesses similar to ${crawl.siteName} ${mainPlace}`] : [])].slice(0, 6);
  if (!keywords.length) keywords.push(`funeral services in ${mainPlace}`);
  const intent = `Find businesses that compete with ${crawl.siteName ?? site.domain} (${site.domain}), which offers: ${services.map((s) => s.label).join(", ") || "funeral support"}. Prefer providers serving ${location}.`;

  const disc = await discoverCandidates({ keywords, location, language: "any", intent }, by, { backgroundVerify: false });
  const found = disc.candidates as any[];
  // Verify now (3 at a time) so the ranking uses our crawler's evidence, not the AI's word.
  const verified: any[] = [];
  for (let i = 0; i < found.length; i += 3) {
    const batch = await Promise.all(found.slice(i, i + 3).map((c) => verifyCandidate(String(c._id)).catch(() => c)));
    verified.push(...batch);
  }
  const own = new Set(services.map((s) => s.category));
  const classRank: Record<string, number> = { direct: 0, service_specialist: 1, indirect: 2, needs_review: 3, aggregator: 5, publisher: 6, unrelated: 9 };
  const ranked = verified
    .map((c) => {
      const shared = (c.verification?.servicesMatched ?? []).filter((x: string) => own.has(x));
      return { candidate: c, shared, score: (c.verification?.state === "verified" ? 0 : 100) + (classRank[c.classification] ?? 4) * 10 - shared.length };
    })
    .sort((a, b) => a.score - b.score);
  const max = Math.min(body.max ?? 3, cfg.COMPETITOR_MAX_COMPETITORS);
  const picks = ranked.filter((r) => r.candidate.status !== "rejected" && r.candidate.verification?.state === "verified" && r.shared.length > 0 && r.candidate.discoveries?.some((d: any) => d.source === "openai_web_search" && d.citationsVerified && d.citations?.length) && !["aggregator", "publisher", "unrelated"].includes(r.candidate.classification)).slice(0, max);
  return {
    site: { url: site.url, domain: site.domain, name: crawl.siteName, pagesRead: crawl.coverage.read },
    detected: { services: services.map((s) => ({ category: s.category, label: s.label, source: s.evidence[0]?.url ?? null })), places: places.slice(0, 10), location },
    queries: keywords,
    picks: picks.map((r) => ({ ...r.candidate, sharedServices: r.shared })),
    all: ranked.map((r) => ({ ...r.candidate, sharedServices: r.shared })),
    rejected: disc.rejected,
    note: "Services and places were read from the website itself; candidates come from cited web results and were each checked by our crawler. Result order is not a Google ranking.",
  };
}

export async function listCandidates(q: { status?: string; watchlisted?: string; classification?: string }) {
  const filter: Record<string, unknown> = { siteScope: SITE_SCOPE };
  if (q.status) filter.status = q.status;
  if (q.watchlisted) filter.watchlisted = q.watchlisted === "true";
  if (q.classification) filter.classification = q.classification;
  return CompetitorCandidate.find(filter).sort({ updatedAt: -1 }).limit(300).lean();
}

export async function updateCandidate(id: string, body: Record<string, unknown>, by: string | null = null) {
  const set = Object.fromEntries(Object.entries(body).filter(([, v]) => v !== undefined));
  const before = await CompetitorCandidate.findOne({ _id: id, siteScope: SITE_SCOPE }).select("domain classification status").lean<any>();
  const res = await CompetitorCandidate.findOneAndUpdate({ _id: id, siteScope: SITE_SCOPE }, { $set: set }, { returnDocument: "after" }).lean();
  if (!res) throw new AnalyzerError(404, "STUDY_NOT_FOUND", "Candidate not found");
  // Learning: the team's judgement about a domain becomes a lesson for future discovery prompts.
  const note = typeof set.notes === "string" && set.notes.trim() ? set.notes.trim().slice(0, 150) : "";
  if (before && set.classification && set.classification !== before.classification) {
    await recordFeedback("candidate_reclassified", `${before.domain} should be classified as "${set.classification}"${note ? ` (${note})` : ""}`, { subject: before.domain, refId: `${id}:class`, by });
  }
  if (before && set.status === "rejected" && before.status !== "rejected") {
    await recordFeedback("candidate_rejected", `${before.domain} is not a relevant competitor${note ? `: ${note}` : ""}`, { subject: before.domain, refId: `${id}:rejected`, by });
  }
  return res;
}

export async function deleteCandidate(id: string) {
  const res = await CompetitorCandidate.deleteOne({ _id: id, siteScope: SITE_SCOPE });
  if (!res.deletedCount) throw new AnalyzerError(404, "STUDY_NOT_FOUND", "Candidate not found");
}

// ── Keywords ──────────────────────────────────────────────────────────────────
export async function generateKeywords(body: { seeds: string[]; location: string; useAi: boolean }) {
  const trained = await loadActiveSettings();
  if (!body.seeds.length) body = { ...body, seeds: trained.settings.keywordSeeds };
  const ownDomain = ownSite().domain;
  const latestRun = await CompetitorRun.findOne({ siteScope: SITE_SCOPE, status: "completed", "studyConfig.ownDomain": ownDomain }).sort({ finishedAt: -1 }).select("_id").lean<any>();
  const latestOwn = latestRun ? await CompetitorSnapshot.findOne({ siteScope: SITE_SCOPE, role: "own", runId: latestRun._id, domain: ownDomain }).lean<any>() : null;
  const latestComp = latestOwn ? await CompetitorSnapshot.find({ runId: latestOwn.runId, role: "competitor" }).lean<any[]>() : [];
  const pagesOf = (snap: any) => (snap?.crawl?.pages ?? []).filter((p: any) => p.state === "read" && p.extract).map((p: any) => ({ url: p.finalUrl ?? p.url, title: p.extract.title, headings: p.extract.headings.map((h: any) => h.text) }));
  const ownPages = pagesOf(latestOwn);
  const ownHeadings = ownPages.flatMap((p: any) => p.headings);
  const raws: { text: string; source: "seed" | "crawl_heading" | "ai_idea" }[] = [
    ...(body.seeds.length ? body.seeds : []).map((s) => ({ text: s, source: "seed" as const })),
    ...headingKeywords([...ownHeadings, ...latestComp.flatMap((s) => pagesOf(s).flatMap((p: any) => p.headings))]).map((h) => ({ text: h, source: "crawl_heading" as const })),
  ];
  let ai: { status: string; error: string | null; count: number } = { status: body.useAi ? "pending" : "not_requested", error: null, count: 0 };
  if (body.useAi) {
    const prompt = buildKeywordPrompt({ seeds: body.seeds, location: body.location, headings: ownHeadings }, { context: trained.settings.prompts.keywordContext, guidance: trained.settings.guidance });
    const res = await budgetedCall(deps.provider, { task: "keywords", promptVersion: KEYWORD_PROMPT_VERSION, system: prompt.system, user: prompt.user, schemaName: "keyword_ideas", schema: KEYWORD_SCHEMA as any, maxOutputTokens: 2_000 }, {});
    if (res.ok) {
      const ideas = Array.isArray((res.data as any)?.ideas) ? (res.data as any).ideas : [];
      for (const i of ideas.slice(0, 40)) if (typeof i?.keyword === "string") raws.push({ text: i.keyword, source: "ai_idea" });
      ai = { status: "ok", error: null, count: ideas.length };
    } else ai = { status: res.budgetBlocked ? "budget_blocked" : "unavailable", error: res.error, count: 0 };
  }
  let upserted = 0;
  for (const r of raws) {
    const rec = buildKeywordRecord(r.text, r.source);
    if (!rec) continue;
    const ownMatches = matchPages(rec.normalized, ownPages);
    const compMatches = latestComp.flatMap((s) => matchPages(rec.normalized, pagesOf(s)).map((m) => ({ domain: s.domain, url: m.url, title: m.title }))).slice(0, 8);
    await CompetitorKeyword.updateOne(
      { siteScope: SITE_SCOPE, normalized: rec.normalized },
      {
        $setOnInsert: { siteScope: SITE_SCOPE, normalized: rec.normalized, keyword: rec.keyword, language: rec.language, intent: rec.intent, cluster: rec.cluster, serviceCategory: rec.serviceCategory, city: rec.city, isQuestion: rec.isQuestion, metrics: { searchVolume: "not_available", difficulty: "not_available", cpc: "not_available", position: "not_available" } },
        $addToSet: { sources: rec.source },
        $set: { ownPages: ownMatches, competitorPages: compMatches, suggestedLandingPage: ownMatches[0]?.url ?? null },
      },
      { upsert: true },
    );
    upserted += 1;
  }
  return { processed: upserted, ai, basedOnRun: latestOwn ? String(latestOwn.runId) : null, note: "Keyword ideas are not measured search demand; volume/difficulty/CPC/position are not_available." };
}

export async function listKeywords(q: { intent?: string; cluster?: string; language?: string }) {
  const filter: Record<string, unknown> = { siteScope: SITE_SCOPE };
  for (const k of ["intent", "cluster", "language"] as const) if (q[k]) filter[k] = q[k];
  const items = await CompetitorKeyword.find(filter).sort({ cluster: 1, normalized: 1 }).limit(1000).lean<any[]>();
  const gaps = items.filter((k) => !k.ownPages?.length && k.competitorPages?.length);
  return { items, contentGaps: gaps.map((k) => ({ keyword: k.keyword, cluster: k.cluster, competitorPages: k.competitorPages })) };
}

// ── Actions ───────────────────────────────────────────────────────────────────
export async function listActions(id: string, q: { status?: string }) {
  await assertStudy(id);
  const filter: Record<string, unknown> = { studyId: id, siteScope: SITE_SCOPE };
  if (q.status) filter.status = q.status;
  return CompetitorAction.find(filter).sort({ priority: 1, updatedAt: -1 }).limit(500).lean();
}

export async function updateAction(id: string, actionId: string, body: Record<string, unknown>, by: string | null) {
  const current = await CompetitorAction.findOne({ _id: actionId, studyId: id, siteScope: SITE_SCOPE }).lean<any>();
  if (!current) throw new AnalyzerError(404, "ACTION_NOT_FOUND", "Action not found");
  const set: Record<string, unknown> = {};
  const history: unknown[] = [];
  for (const k of ["status", "assignee", "dueDate", "notes", "priority"]) {
    if (body[k] === undefined) continue;
    const v = k === "dueDate" && body[k] ? new Date(body[k] as string) : body[k];
    set[k] = v;
    history.push({ at: new Date(), by: by ?? "unknown", field: k, from: current[k] ?? null, to: v });
  }
  if (!history.length) return current;
  const updated = await CompetitorAction.findOneAndUpdate({ _id: actionId, studyId: id }, { $set: set, $push: { history: { $each: history, $slice: -200 } } }, { returnDocument: "after" }).lean<any>();
  // Learning: rejected / approved AI recommendations steer future comparison prompts.
  const reason = typeof body.notes === "string" && body.notes.trim() ? body.notes.trim().slice(0, 200) : "";
  if (set.status === "rejected" && current.status !== "rejected") {
    await recordFeedback("action_rejected", `Do not recommend again: "${current.title}"${reason ? ` (team reason: ${reason})` : ""}`, { subject: current.title, reason, refId: String(actionId), by });
  } else if (["approved", "todo", "doing", "implemented", "verified"].includes(String(set.status)) && current.status === "needs_review" && current.source === "ai") {
    await recordFeedback("action_approved", `The team found this kind of recommendation useful: "${current.title}"`, { subject: current.title, refId: String(actionId), by });
  }
  return updated;
}

// ── Health ────────────────────────────────────────────────────────────────────
export async function providerHealth(workerRunning: boolean) {
  const cfg = analyzerConfig();
  const ai = deps.provider.readiness();
  const lastBeat = await CompetitorWorker.findOne({ siteScope: SITE_SCOPE, expiresAt: { $gt: new Date() } }).sort({ heartbeatAt: -1 }).select("heartbeatAt").lean<any>();
  return {
    analyzerEnabled: cfg.COMPETITOR_ANALYZER_ENABLED,
    primarySite: cfg.primarySiteUrl,
    ai: { state: ai.state, reason: ai.reason, model: ai.model, webSearch: ai.webSearch ? "enabled" : "disabled", lastError: lastAiError },
    budget: await budgetStatus(),
    queue: { mode: cfg.COMPETITOR_QUEUE_ENABLED ? (queueReady() ? "bullmq+mongo" : "mongo (BullMQ not connected)") : "mongo polling" },
    worker: { inProcess: cfg.COMPETITOR_INPROCESS_WORKER, running: !!lastBeat, lastHeartbeatAt: lastBeat?.heartbeatAt ?? null },
    pagespeed: { state: cfg.COMPETITOR_PAGESPEED_ENABLED ? "enabled" : "disabled", apiKey: process.env.PAGESPEED_API_KEY ? "configured" : "not_configured" },
    searchConsole: await (async () => { const g = await googleStatus(); return { state: g.status, reason: g.status === "connected" ? (g.property ? `Property ${g.property}${g.lastSyncAt ? `, last sync ${new Date(g.lastSyncAt).toISOString().slice(0, 10)}` : ""}` : "Connected — choose a property") : g.lastError ?? (g.configured ? "Not connected — use Connect Google" : "GOOGLE_OAUTH_* not configured"), email: g.email, property: g.property }; })(),
    renderer: renderingEnabled() && browserExecutable() ? { state: "ready", reason: `Headless ${/msedge/i.test(browserExecutable() ?? "") ? "Edge" : "Chrome"} for JavaScript-only pages (every request checked; GET only)` } : { state: renderingEnabled() ? "not_available" : "disabled", reason: renderingEnabled() ? "No Chrome/Edge found (set COMPETITOR_BROWSER_EXECUTABLE)" : "COMPETITOR_BROWSER_RENDERING_ENABLED=false" },
    scheduler: { state: schedulerEnabled() ? (schedulerRunning() ? "ready" : "enabled_not_running") : "disabled", scheduledStudies: await CompetitorStudy.countDocuments({ siteScope: SITE_SCOPE, status: "active", "settings.schedule": { $in: ["weekly", "monthly"] } }), nextDue: (await CompetitorStudy.findOne({ siteScope: SITE_SCOPE, status: "active", nextScheduledAt: { $ne: null } }).sort({ nextScheduledAt: 1 }).select("nextScheduledAt").lean<any>())?.nextScheduledAt ?? null },
    limits: { maxCompetitors: cfg.COMPETITOR_MAX_COMPETITORS, defaultPagesPerSite: cfg.COMPETITOR_DEFAULT_PAGES_PER_SITE, maxPagesPerSite: cfg.COMPETITOR_MAX_PAGES_PER_SITE, cooldownMinutes: cfg.COMPETITOR_RUN_COOLDOWN_MINUTES },
  };
}

export const isObjectId = (v: string) => Types.ObjectId.isValid(v);
