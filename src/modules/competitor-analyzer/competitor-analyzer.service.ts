import { enqueueDueReports } from './outbox';
import { BadRequestException, ConflictException, ForbiddenException, HttpException, HttpStatus, NotFoundException, ServiceUnavailableException, logger } from './errors';
import { AnalyzerRepository } from './repository';
import type { CompetitorStudy } from './models';
import { Alert, Task } from './models';
import { Admin } from '../../models/Admin.model';
import { emailAdapter, organisation, localReportLogo, networkDeps, loadSearchConsoleReport, type TenantContext } from './adapters';
import { enqueueRun } from './queue';
import { BUSINESS_PROFILES, saveProfileResults } from './profiles';
import { crawlAllocation, mapLimited, defaultProfileFor } from './industry-settings';
import { buildBusinessIntelligence,businessStrings,translateBusiness, type BusinessIntelligence } from './business-intelligence';
import { enqueueDiscovery } from './deep-discovery';
import { createHmac } from 'node:crypto';
import { aiLimits, costMicros, estimateTokens, providerKey } from '../website-intelligence/ai/website-ai.config';
import { callProvider } from './budget-provider';
import { knowledgeGraphApiKey, searchEntities } from '../website-intelligence/website-brand';
import { ANALYZER_PROMPT_VERSION, EMPTY_PROFILES, buildAnalyzerPrompts, validateCompare, validateProfiles, type AnalyzerResult } from './analyzer-ai';
import { completedOffers, diffRuns, type SiteChange } from './analyzer-changes';
import { measureSite, normalizeSite, probeSiteName, readHomeSummary, readSiteLocations, type OwnSearch, type SiteEvidence } from './analyzer-evidence';
import { LOCATION_PROMPT_VERSION, LOCATION_SYSTEM, MAX_SUGGESTIONS, SUGGEST_PROMPT_VERSION, SUGGEST_SYSTEM, isIgnoredHost, locationUserPrompt, nameMatchesSite, suggestUserPrompt, validateLocation, validateSuggest, type CompetitorSuggestionItem, type SiteLocation, type SuggestScope, type SuggestionResult } from './analyzer-suggest';
import { createAnalyzerRenderer } from './analyzer-renderer';
import { instagramStats, socialProfiles, youtubeStats, type SiteSocials } from './analyzer-social';
import { assessQuality, deterministicComparison, measuredAnalysis, validateRecommendations } from './analyzer-intelligence';
import { buildCanonicalReportModel } from './analyzer-report-model';
import { HINDI_PROMPT_VERSION, TRANSLATE_SYSTEM, applyTranslations, collectStrings, translateUserPrompt, validateTranslations, type ReportLang, type Translatable } from './analyzer-hindi';
import { OFFERS_PROMPT_VERSION, OFFERS_SYSTEM, emptyOffers, offerSnippets, offersUserPrompt, validateOffers, type OffersBlock } from './analyzer-offers';
import { renderAnalyzerPdf } from './analyzer-pdf';
import { REPORT_PROMPT_VERSION, buildReportPrompt, validateReport, type ReportNarrative } from './analyzer-report';
import { actionKey, changesEmail, nextCheckAt, nextReportAt, readActions, readSettings, reportEmail, validEmail, type ActionStatus, type StudySettings } from './analyzer-tracking';

export const MAX_COMPETITORS = 8;
/** A new run within this window returns the running / latest one instead of paying again. */
const MIN_RERUN_MS = 10 * 60 * 1000;
/** A run still "running" after this long was interrupted (server restart) and is closed as failed. */
const STALE_RUN_MS = 6 * 60 * 1000;
const MAX_OUTPUT_TOKENS = 6_000;
const AI_TIMEOUT_MS = 150_000;
const MAX_STUDIES = 50;
/** Business-name lookups per company per hour (Knowledge Graph quota is shared by every company). */
const LOOKUPS_PER_HOUR = 60;
const lookups = new Map<string, number[]>();
/** Paid competitor suggestions per company per hour; the same website is answered from the 7-day cache for free. */
const SUGGESTS_PER_HOUR = 10;
const suggests = new Map<string, number[]>();
const SUGGESTION_CACHE_MS = 7 * 24 * 60 * 60 * 1000;
/** Paid location reads per company per hour (one small AI call each; cached 7 days per website). */
const LOCATIONS_PER_HOUR = 30;
const locationReads = new Map<string, number[]>();
const NAME_PROBES_PER_HOUR = 300;
const nameProbes = new Map<string, number[]>();

const GENERIC_NAME = /^(home|home ?page|welcome|index|main|untitled|official (web)?site)$/i;
/** A usable site name, or null: generic words ("Home") and long taglines are not names, so the domain is shown instead. */
const cleanName = (value: unknown) => {
  if (typeof value !== 'string') return null;
  const name = value.trim().replace(/\s+/g, ' ');
  return name && name.length <= 48 && !GENERIC_NAME.test(name) ? name : null;
};
/** Sites as sent to the browser: stored names that are not usable are dropped. */
const shownSites = (sites: StudySite[]) => sites.map((s) => ({ ...s, name: cleanName(s.name) }));
const fillingNames = new Set<string>();

/** Sets `name` from the given names (by domain). Without `overwrite`, names already known are kept. */
function withNames(sites: StudySite[], names: Record<string, unknown>, overwrite = false): StudySite[] {
  return sites.map((s) => {
    const found = cleanName(names[s.domain]);
    return { ...s, name: overwrite ? (found ?? s.name ?? null) : (s.name ?? found ?? null) };
  });
}
const evidenceNames = (evidence: unknown) => Object.fromEntries(((evidence ?? []) as SiteEvidence[]).filter((e) => e?.name).map((e) => [e.domain, e.name]));
/** Report e-mails per study per day sent by hand. */
const EMAILS_PER_DAY = 10;
const emails = new Map<string, number[]>();

/** `name` is what the site calls itself (null: none found, missing: not looked up yet). */
export interface StudySite { url: string; domain: string; role: 'own' | 'competitor'; name?: string | null }
type Trigger = 'manual' | 'scheduled';

/**
 * Competitor Analyzer: a company compares its own website with up to four competitors. Each run reads the public pages
 * of every site, measures them (counts, sitemap activity, Google PageSpeed, Knowledge Graph, and Search Console for the
 * company's own site when connected) and asks the AI for a cited comparison and an action plan. Runs are kept, so
 * changes between runs and score history show how the competition moves; studies can re-check themselves on a schedule
 * and send alerts and a monthly PDF report.
 */
export class CompetitorAnalyzerService {
  private readonly logger = logger;

  constructor(private readonly repository = new AnalyzerRepository(), private readonly email = emailAdapter) {}

  /**
   * The company's own Instagram professional account and its Page token, for Business Discovery look-ups of the
   * competitors' Instagram accounts. Null when Meta is not connected or no Page has an Instagram account.
   */
  private async instagramViewer(companyId: string): Promise<{ igUserId: string; token: string; appSecret: string; version: string } | null> {
    const userToken = process.env.COMPETITOR_META_ACCESS_TOKEN;
    if (!userToken) return null;
    const appSecret = process.env.META_APP_SECRET ?? '';
    const version = process.env.META_GRAPH_API_VERSION ?? 'v21.0';
    const q = new URLSearchParams({ fields: 'access_token,instagram_business_account{id}', limit: '50', access_token: userToken, ...(appSecret ? { appsecret_proof: createHmac('sha256', appSecret).update(userToken).digest('hex') } : {}) });
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10_000);
    try {
      const res = await fetch(`https://graph.facebook.com/${version}/me/accounts?${q}`, { signal: controller.signal });
      const body = (await res.json().catch(() => ({}))) as { data?: { access_token?: string; instagram_business_account?: { id?: string } }[] };
      const page = (body.data ?? []).find((p) => p.instagram_business_account?.id && p.access_token);
      return page ? { igUserId: page.instagram_business_account!.id!, token: page.access_token!, appSecret, version } : null;
    } finally {
      clearTimeout(timer);
    }
  }

  /** Profiles each site links to, plus YouTube and Instagram numbers from the official APIs. Never fails the run. */
  private async collectSocials(companyId: string, measured: { evidence: SiteEvidence; digest: { pages: { socialLinks?: string[] }[] } | null }[]) {
    const profiles = measured.map((m) => socialProfiles(m.digest?.pages.flatMap((p) => p.socialLinks ?? []) ?? []));
    const needsInstagram = profiles.some((list) => list.some((p) => p.platform === 'instagram'));
    const viewer = needsInstagram ? await this.instagramViewer(companyId).catch((error) => {
      this.logger.warn({ msg: 'competitor_analyzer.instagram_viewer_failed', companyId, error: error instanceof Error ? error.message : 'unknown' });
      return null;
    }) : null;
    const youtubeKey = process.env.YOUTUBE_API_KEY || null;
    const checkedAt = new Date().toISOString();
    await Promise.all(
      measured.map(async (m, i) => {
        if (!m.digest) return;
        const list = profiles[i]!;
        const yt = list.find((p) => p.platform === 'youtube');
        const ig = list.find((p) => p.platform === 'instagram');
        const [youtube, instagram] = await Promise.all([yt ? youtubeStats(yt, youtubeKey) : null, ig ? instagramStats(ig, viewer) : null]);
        const socials: SiteSocials = { profiles: list, youtube, instagram, checkedAt };
        m.evidence.socials = socials;
      }),
    );
  }

  private companyId(t: TenantContext): string {
    if (!t.companyId) throw new ForbiddenException('A company context is required.');
    return t.companyId;
  }

  private sitesFrom(own: string, competitors: string[]): StudySite[] {
    const ownSite = normalizeSite(own);
    if (!ownSite) throw new BadRequestException({ message: `“${own}” is not a website address.`, reason: 'invalid_site' });
    const list: StudySite[] = [{ ...ownSite, role: 'own' }];
    for (const raw of competitors) {
      const site = normalizeSite(raw);
      if (!site) throw new BadRequestException({ message: `“${raw}” is not a website address.`, reason: 'invalid_site' });
      if (list.some((s) => s.domain === site.domain)) continue;
      list.push({ ...site, role: 'competitor' });
    }
    const count = list.length - 1;
    if (count < 1) throw new BadRequestException({ message: 'Add at least one competitor website (different from yours).', reason: 'no_competitors' });
    if (count > MAX_COMPETITORS) throw new BadRequestException({ message: `Compare at most ${MAX_COMPETITORS} competitors at a time.`, reason: 'too_many_competitors' });
    return list;
  }

  private async study(companyId: string, id: string) {
    const study = await this.repository.competitorStudy.findFirst({ where: { id, companyId, archivedAt: null } });
    if (!study) throw new NotFoundException('Analysis not found.');
    return study;
  }

  private async clientInCompany(companyId: string, clientId: string | undefined | null) {
    if (!clientId) return null;
    const client = await this.repository.client.findFirst({ where: { id: clientId, companyId }, select: { id: true } });
    if (!client) throw new BadRequestException({ message: 'That client does not belong to this company.', reason: 'invalid_client' });
    return client.id;
  }

  /** The client this study is about: the one it was linked to, else the company's client whose website is the own site. */
  private async clientFor(companyId: string, study: Pick<CompetitorStudy, 'clientId' | 'sites'>) {
    if (study.clientId) return this.repository.client.findFirst({ where: { id: study.clientId, companyId }, select: { id: true, name: true, website: true } });
    const own = (study.sites as unknown as StudySite[])[0]?.domain;
    if (!own) return null;
    const candidates = await this.repository.client.findMany({ where: { companyId, website: { contains: own, mode: 'insensitive' } }, select: { id: true, name: true, website: true }, take: 5 });
    return candidates.find((c) => normalizeSite(c.website ?? '')?.domain === own) ?? null;
  }

  async create(t: TenantContext, dto: { name?: string; own: string; competitors: string[]; clientId?: string | null; names?: Record<string, string> }) {
    const companyId = this.companyId(t);
    const sites = this.sitesFrom(dto.own, dto.competitors);
    const active = await this.repository.competitorStudy.count({ where: { companyId, archivedAt: null } });
    if (active >= MAX_STUDIES) throw new ConflictException({ message: `This company already has ${MAX_STUDIES} analyses. Archive old ones first.`, reason: 'too_many_studies' });
    let clientId = await this.clientInCompany(companyId, dto.clientId);
    if (!clientId) {
      const existing = await this.repository.client.findFirst({ where: { companyId, website: sites[0]!.url } });
      const client = existing ?? await this.repository.client.create({ data: { companyId, name: dto.names?.[sites[0]!.domain] ?? sites[0]!.domain, website: sites[0]!.url } });
      clientId = client.id;
    }
    const name = (dto.name?.trim() || `${sites[0]!.domain} vs ${sites.slice(1).map((s) => s.domain).join(', ')}`).slice(0, 120);
    const study = await this.repository.competitorStudy.create({ data: { companyId, clientId, name, sites: withNames(sites, dto.names ?? {}) as never, createdByUserId: t.userId } });
    return this.detail(t, study.id);
  }

  async update(t: TenantContext, id: string, dto: { name?: string; own?: string; competitors?: string[]; names?: Record<string, string> }) {
    const companyId = this.companyId(t);
    const study = await this.study(companyId, id);
    const current = study.sites as unknown as StudySite[];
    const sites = dto.own !== undefined || dto.competitors !== undefined
      ? this.sitesFrom(dto.own ?? current[0]!.url, dto.competitors ?? current.slice(1).map((s) => s.url))
      : current;
    // Sites kept from before keep their names; new ones take the names typed in the form.
    const known = Object.fromEntries(current.filter((s) => s.name).map((s) => [s.domain, s.name]));
    const named = withNames(sites.map((s) => ({ url: s.url, domain: s.domain, role: s.role })), { ...(dto.names ?? {}), ...known });
    await this.repository.competitorStudy.update({ where: { id: study.id }, data: { name: dto.name?.trim() ? dto.name.trim().slice(0, 120) : undefined, sites: named as never } });
    return this.detail(t, id);
  }

  async archive(t: TenantContext, id: string) {
    const companyId = this.companyId(t);
    const study = await this.study(companyId, id);
    await this.repository.competitorStudy.update({ where: { id: study.id }, data: { archivedAt: new Date(), nextCheckAt: null, nextReportAt: null } });
  }

  /** Names a study's sites from its last finished check, reading the home page of any site still unnamed. */
  private async fillNames(studyId: string) {
    if (fillingNames.has(studyId)) return;
    fillingNames.add(studyId);
    try {
      const study = await this.repository.competitorStudy.findUnique({ where: { id: studyId }, select: { sites: true, updatedAt: true } });
      if (!study) return;
      const done = await this.repository.competitorStudyRun.findFirst({ where: { studyId, status: 'completed' }, orderBy: { startedAt: 'desc' }, select: { sites: true } });
      const named = withNames(study.sites as unknown as StudySite[], evidenceNames(done?.sites));
      const probed = await Promise.all(named.map(async (s) => (s.name ? s : { ...s, name: await probeSiteName(s.url, networkDeps()).then((probe) => (probe.movedTo ? null : cleanName(probe.name))) })));
      await this.repository.competitorStudy.update({ where: { id: studyId }, data: { sites: probed as never, updatedAt: study.updatedAt } });
    } catch (error) {
      this.logger.warn({ msg: 'competitor_analyzer.names_failed', studyId, error: error instanceof Error ? error.message : String(error) });
    } finally {
      fillingNames.delete(studyId);
    }
  }

  /** Stores the names the sites gave themselves in this check; sites removed meanwhile are left alone. */
  private async refreshNames(studyId: string, evidence: unknown) {
    const fresh = await this.repository.competitorStudy.findUnique({ where: { id: studyId }, select: { sites: true } });
    if (!fresh) return;
    const sites = fresh.sites as unknown as StudySite[];
    const next = withNames(sites, evidenceNames(evidence), true);
    if (JSON.stringify(next) !== JSON.stringify(sites)) await this.repository.competitorStudy.update({ where: { id: studyId }, data: { sites: next as never } });
  }

  async siteName(t: TenantContext, url: string) {
    const companyId = this.companyId(t);
    const site = normalizeSite(url);
    if (!site) throw new BadRequestException({ message: `“${url}” is not a website address.`, reason: 'invalid_site' });
    const now = Date.now();
    const recent = (nameProbes.get(companyId) ?? []).filter((at) => now - at < 60 * 60 * 1000);
    if (recent.length >= NAME_PROBES_PER_HOUR) throw new HttpException({ message: 'Too many website lookups this hour. Try again later.', reason: 'rate_limited' }, HttpStatus.TOO_MANY_REQUESTS);
    nameProbes.set(companyId, [...recent, now]);
    const probe = await probeSiteName(site.url, networkDeps());
    // An address that hands visitors to another website shows no name (it would be the other site's) and says where it goes.
    return { domain: site.domain, url: site.url, name: probe.movedTo ? null : cleanName(probe.name), reachable: probe.reachable, movedTo: probe.movedTo };
  }

  /** Runs left "running" by a restarted server are closed so the UI never spins forever. */
  /** Every study's runs left "running" by a server that stopped; the scheduler calls this so none waits for a page view. */
  /** Recovery belongs to the durable worker; reading a report never closes a healthy job. */
  async closeStaleRuns() { return 0; }
  private async closeStale(_studyId: string) { }

  async list(t: TenantContext) {
    const companyId = this.companyId(t);
    const studies = await this.repository.competitorStudy.findMany({
      where: { companyId, archivedAt: null },
      orderBy: { updatedAt: 'desc' },
      take: MAX_STUDIES,
      include: { runs: { orderBy: { startedAt: 'desc' }, take: 5, select: { id: true, status: true, stage: true, startedAt: true, finishedAt: true, sites: true, ai: true } } },
    });
    // Studies made before names were stored get them in the background; the next load shows them.
    for (const s of studies) {
      if ((s.sites as unknown as StudySite[]).some((x) => x.name === undefined)) void this.fillNames(s.id);
    }
    return studies.map((s) => {
      const run = s.runs[0];
      // Scores and the summary come from the last finished check, so a re-check in progress keeps showing them.
      const done = s.runs.find((r) => r.status === 'completed');
      const result = ((done?.ai ?? null) as { result?: AnalyzerResult } | null)?.result ?? null;
      const model = done ? buildCanonicalReportModel(done) : null;
      const progress = readActions(s.actions);
      const actionStates = (result?.actions ?? []).map((a) => progress[actionKey(a.action)]?.status ?? 'todo');
      return {
        id: s.id,
        name: s.name,
        clientId: s.clientId,
        sites: shownSites(s.sites as unknown as StudySite[]),
        updatedAt: s.updatedAt,
        schedule: readSettings(s.settings).schedule,
        nextCheckAt: s.nextCheckAt,
        latestRun: run ? { id: run.id, status: run.status, stage: run.stage, startedAt: run.startedAt, finishedAt: run.finishedAt, overall: result?.overall ?? null, checkedAt: done?.finishedAt ?? null } : null,
        summary: result
          ? {
            overview: model?.summary ?? result.overview,
            threats: result.headToHead.map((h) => ({ domain: h.competitor, threat: h.threat })),
            gaps: result.gaps.length,
            actions: { total: actionStates.length, high: (result.actions ?? []).filter((a) => a.priority === 'high').length, done: actionStates.filter((x) => x === 'done').length, doing: actionStates.filter((x) => x === 'doing').length },
          }
          : null,
      };
    });
  }

  async detail(t: TenantContext, id: string) {
    const companyId = this.companyId(t);
    return this.detailFor(companyId, await this.study(companyId, id));
  }

  /**
   * What a client sees through a share link: the same report without anything internal (action-plan progress, linked
   * client, schedule and e-mail settings, AI cost, the company's own Google Search Console data).
   */
  async sharedDetail(companyId: string, studyId: string) {
    const full = await this.detailFor(companyId, await this.study(companyId, studyId));
    const strip = <T extends { sites?: unknown }>(run: T) => ({ ...run, sites: ((run.sites ?? []) as SiteEvidence[]).map(({ search: _search, ...rest }) => rest) });
    return {
      ...full,
      id: 'shared',
      clientId: null,
      linkedClient: null,
      settings: readSettings({}),
      actions: {},
      nextCheckAt: null,
      nextReportAt: null,
      latestRun: null,
      report: full.report ? { ...strip(full.report), model: { ...full.report.model, sites: full.report.model.sites.map(({ search: _search, ...rest }) => rest) }, costUsd: null } : null,
    };
  }

  /** PDF of the latest completed check for a share link (same file the team downloads). */
  async sharedPdf(companyId: string, studyId: string, lang: ReportLang) {
    return this.buildPdf(companyId, await this.study(companyId, studyId), lang);
  }

  private async detailFor(companyId: string, study: CompetitorStudy) {
    await this.closeStale(study.id);
    const runs = await this.repository.competitorStudyRun.findMany({ where: { studyId: study.id, companyId }, orderBy: { startedAt: 'desc' }, take: 30 });
    const latest = runs[0] ?? null;
    const completed = runs.filter((r) => r.status === 'completed');
    const lastCompleted = completed[0] ?? null;
    // The check before the report, for score trends per area.
    const before = completed[1] ?? null;
    const beforeAi = (before?.ai as { result?: AnalyzerResult } | null)?.result ?? null;
    const client = await this.clientFor(companyId, study);
    return {
      id: study.id,
      name: study.name,
      profile: study.profile,
      crawlBudget:study.crawlBudget,
      clientId: study.clientId,
      linkedClient: client ? { id: client.id, name: client.name } : null,
      sites: shownSites(withNames(study.sites as unknown as StudySite[], evidenceNames(lastCompleted?.sites))),
      settings: readSettings(study.settings),
      actions: readActions(study.actions),
      nextCheckAt: study.nextCheckAt,
      nextReportAt: study.nextReportAt,
      createdAt: study.createdAt,
      updatedAt: study.updatedAt,
      latestRun: latest ? this.runView(latest, false) : null,
      report: lastCompleted
        ? {
          ...this.runView(lastCompleted, true),
          model: buildCanonicalReportModel(lastCompleted),
          previous: before ? { at: before.finishedAt ?? before.startedAt, overall: beforeAi?.overall ?? null, scores: Object.fromEntries((beforeAi?.scores ?? []).map((s) => [s.area, s.scores])) } : null,
        }
        : null,
      history: completed
        .map((r) => ({ id: r.id, at: r.finishedAt ?? r.startedAt, overall: ((r.ai as any)?.result?.overall ?? null) as Record<string, number> | null, speed: Object.fromEntries(((r.sites ?? []) as unknown as SiteEvidence[]).map((s) => [s.domain, s.speed?.performance ?? null])) }))
        .reverse(),
    };
  }

  private runView(run: any, full: boolean) {
    return {
      id: run.id,
      status: run.status,
      stage: run.stage,
      startedAt: run.startedAt,
      finishedAt: run.finishedAt,
      errorMessage: run.errorMessage,
      ...(full ? { businessIntelligence:run.businessIntelligence,crawlUsage:run.crawlUsage, profileResults: run.profileResults, sites: run.sites, ai: run.ai, changes: run.changes, costUsd: run.costMicros != null ? Number(run.costMicros) / 1_000_000 : null } : {}),
    };
  }

  async runStatus(t: TenantContext, id: string, runId: string) {
    const companyId = this.companyId(t);
    const study = await this.study(companyId, id);
    await this.closeStale(study.id);
    const run = await this.repository.competitorStudyRun.findFirst({ where: { id: runId, studyId: study.id, companyId } });
    if (!run) throw new NotFoundException('Run not found.');
    return this.runView(run, false);
  }

  private async spendToday(companyId: string) {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const [web, studies, suggestions] = await Promise.all([
      Promise.resolve({ _sum: { estimatedCostMicros: 0 } }),
      this.repository.competitorStudyRun.aggregate({ where: { companyId, startedAt: { gte: since } }, _sum: { costMicros: true } }),
      this.repository.competitorSuggestion.aggregate({ where: { companyId, createdAt: { gte: since } }, _sum: { costMicros: true } }),
    ]);
    return Number(web._sum.estimatedCostMicros ?? 0n) + Number(studies._sum.costMicros ?? 0n) + Number(suggestions._sum.costMicros ?? 0n);
  }

  /* ------------------------------------------------------------------ */
  /* Runs                                                                */
  /* ------------------------------------------------------------------ */

  /** Starts a run in the background and returns it; the UI polls the run until it finishes. */
  async run(t: TenantContext, id: string) {
    const companyId = this.companyId(t);
    const study = await this.study(companyId, id);
    const started = await this.startRun(companyId, study, 'manual');
    return started!;
  }

  /** Shared by the button and the scheduler. A scheduled start that is too soon is skipped instead of refused. */
  async startRun(companyId: string, study: CompetitorStudy, trigger: Trigger) {
    await this.closeStale(study.id);
    const recent = await this.repository.competitorStudyRun.findFirst({ where: { studyId: study.id, companyId }, orderBy: { startedAt: 'desc' } });
    if (recent?.status === 'running') return { run: this.runView(recent, false), reused: true };
    if (recent?.status === 'completed' && Date.now() - recent.startedAt.getTime() < MIN_RERUN_MS) {
      if (trigger === 'scheduled') return null;
      throw new HttpException({ message: 'This analysis was refreshed less than 10 minutes ago. Try again a little later.', reason: 'too_soon' }, HttpStatus.TOO_MANY_REQUESTS);
    }
    const { run, reused } = await enqueueRun(companyId, study, trigger);
    await this.repository.competitorStudy.update({ where: { id: study.id }, data: { updatedAt: new Date() } });
    return { run: this.runView(run, false), reused };
  }

  /** Moves a run to its next stage; false when it was stopped meanwhile (the caller then gives up). */
  private async stage(runId: string, stage: string) {
    const moved = await this.repository.competitorStudyRun.updateMany({ where: { id: runId, status: 'running' }, data: { stage } });
    return moved.count > 0;
  }

  /**
   * Stops a running check. Stopped while reading, no AI is called; stopped during the AI step, the answer is thrown
   * away (its cost still counts in the daily AI budget). The study can be checked again straight away.
   */
  async stopRun(t: TenantContext, id: string, runId: string) {
    const companyId = this.companyId(t);
    const study = await this.study(companyId, id);
    await this.repository.competitorStudyRun.updateMany({
      where: { id: runId, studyId: study.id, companyId, status: 'running' },
      data: { status: 'cancelled', job: 'cancelled', stage: null, finishedAt: new Date(), errorMessage: 'Stopped. Run it again when you are ready.' },
    });
    const run = await this.repository.competitorStudyRun.findFirst({ where: { id: runId, studyId: study.id, companyId } });
    if (!run) throw new NotFoundException('Run not found.');
    this.logger.log({ msg: 'competitor_analyzer.stopped', companyId, studyId: study.id, runId, status: run.status });
    return this.runView(run, false);
  }

  /** The company's own Search Console data (last 28 days) when the own site's client has it connected. */
  private async ownSearch(companyId: string, study: CompetitorStudy): Promise<OwnSearch | null> {
    try {
      const property = process.env.COMPETITOR_SEARCH_CONSOLE_PROPERTY || process.env.GSC_SITE_URL || process.env.SEARCH_CONSOLE_SITE_URL;
      if (!property) return null;
      const own = (study.sites as StudySite[])[0];
      const configured = property.replace(/^sc-domain:/, '').replace(/^https?:\/\//, '').split('/')[0];
      if (!own || own.domain !== configured?.replace(/^www\./, '')) return null;
      const sc = { property };
      const report = await loadSearchConsoleReport(sc.property, '28d');
      if (!report.ok) return null;
      const d = report.data;
      return {
        property: d.property,
        range: d.range,
        totals: { clicks: d.totals.clicks, impressions: d.totals.impressions, ctr: Math.round(d.totals.ctr * 100) / 100, position: Math.round(d.totals.position * 10) / 10 },
        queries: [...d.queries].sort((a, b) => b.impressions - a.impressions).slice(0, 40).map((q) => ({ query: q.query, clicks: q.clicks, impressions: q.impressions, position: Math.round(q.position * 10) / 10 })),
      };
    } catch {
      return null;
    }
  }

  async execute(companyId: string, study: CompetitorStudy, runId: string, trigger: Trigger) {
    const studyId = study.id;
    const sites = study.sites as unknown as StudySite[];
    const allocation=crawlAllocation(study.crawlBudget,sites.length);
    let httpRequests=0;
    const deps = {...networkDeps(),onRequest:()=>{if(httpRequests>=allocation.budget.maxHttpRequests)throw new Error('The configured crawl HTTP budget was exhausted.');httpRequests++;}};
    const renderer = await createAnalyzerRenderer(deps).catch((error) => {
      this.logger.warn({ msg: 'competitor_analyzer.renderer_unavailable', error: error instanceof Error ? error.message : 'unknown' });
      return null;
    });
    let measured: Awaited<ReturnType<typeof measureSite>>[];
    let search: OwnSearch | null;
    try {
      [measured, search] = await Promise.all([mapLimited(sites, allocation.budget.concurrency, (site,index) => measureSite(site, deps, { renderer, maxPages: allocation.pages[index], businessProfile:study.profile==='expo-organic-v1', preferredPaths: BUSINESS_PROFILES.find(p=>p.id===study.profile)?.importantPaths, journeyRules: BUSINESS_PROFILES.find(p=>p.id===study.profile)?.journeys, pagespeed: !(process.env.NODE_ENV === 'test' && process.env.COMPETITOR_TEST_HTTP_PORT) })), this.ownSearch(companyId, study)]);
    } finally {
      await renderer?.close().catch(() => undefined);
    }
    await this.collectSocials(companyId, measured);
    const evidence = measured.map((m) => m.evidence);
    if (search) evidence[0]!.search = search;
    const own = measured[0]!;
    // Every write below only touches a run that is still running, so a stopped run stays stopped.
    if (!own.digest) {
      await this.repository.competitorStudyRun.updateMany({ where: { id: runId, status: 'running' }, data: { status: 'failed', stage: null, finishedAt: new Date(), sites: evidence as never, errorMessage: `Your website could not be read: ${own.evidence.error ?? 'no HTML page'}` } });
      return;
    }
    const readable = measured.filter((m) => m.digest);
    if (readable.length < 2) {
      await this.repository.competitorStudyRun.updateMany({ where: { id: runId, status: 'running' }, data: { status: 'failed', stage: null, finishedAt: new Date(), sites: evidence as never, errorMessage: 'None of the competitor websites could be read. Check the addresses.' } });
      return;
    }

    // 2. AI comparison, inside the company's daily AI budget. Without AI the measured comparison is still saved.
    if (!(await this.stage(runId, 'analysing'))) {
      this.logger.log({ msg: 'competitor_analyzer.stopped_before_ai', companyId, studyId, runId });
      return;
    }
    let ai: Record<string, unknown> = { status: 'unavailable', reason: '' };
    let usage: { model?: string; inputTokens?: number; outputTokens?: number; costMicros?: bigint } = {};
    if (aiLimits.defaultMode() === 'disabled') ai = { status: 'unavailable', reason: 'AI insights are switched off on this server.' };
    else if (!providerKey('openai')) ai = { status: 'unavailable', reason: 'AI insights are not set up on the server yet.' };
    else if ((await this.spendToday(companyId)) >= aiLimits.dailyBudgetMicros()) ai = { status: 'unavailable', reason: 'Today’s AI limit for this company is used up; the measured comparison is shown. Try again tomorrow.' };
    else {
      // Two answers in parallel on the same evidence: the comparison (required) and the site profiles (optional extra).
      // The main comparison is shareable. Private Search Console metrics remain in the authenticated Search panel.
      const prompts = buildAnalyzerPrompts(readable.map((m) => ({ evidence: { ...m.evidence, search: null }, digest: m.digest! })));
      // A third, small answer: the facts each site states about what it sells and its events, from short excerpts only.
      // Product / service names come from link labels and headings, which may sit beyond the 20,000-character page
      // text: they are added to that page's text so their quotes can still be checked.
      const offersInput = readable.map((m) => {
        const catalogue = m.catalogue ?? [];
        const pages = m.texts.map((t) => ({ url: t.url, text: [t.text, catalogue.find((c) => c.url === t.url)?.text ?? ''].join('\n') }));
        return { domain: m.evidence.domain, pages, excerpts: [...catalogue, ...offerSnippets(m.texts)] };
      });
      const offersPrompt = { system: OFFERS_SYSTEM, user: offersUserPrompt(offersInput) };
      const wantOffers = offersInput.some((site) => site.excerpts.length > 0);
      // Reserve the required comparison before optional calls compete for the remaining budget.
      const compare=await callProvider('openai',{...prompts.compare,maxOutputTokens:MAX_OUTPUT_TOKENS+Math.max(0,readable.length-5)*700,timeoutMs:AI_TIMEOUT_MS});
      const [profiles, offersRes] = await Promise.all([
        // Profiles carry an outline and search phrases per content idea, so they get more room than the comparison.
        callProvider('openai', { ...prompts.profiles, maxOutputTokens: MAX_OUTPUT_TOKENS + 2_000, timeoutMs: AI_TIMEOUT_MS }),
        wantOffers ? callProvider('openai', { ...offersPrompt, maxOutputTokens: 7_000, timeoutMs: AI_TIMEOUT_MS }) : Promise.resolve(null),
      ]);
      let model = '';
      let input = 0;
      let output = 0;
      let micros = 0;
      for (const [res, prompt] of [[compare, prompts.compare], [profiles, prompts.profiles], [offersRes, offersPrompt]] as const) {
        if (!res?.ok) continue;
        const i = res.usage.inputTokens ?? estimateTokens(prompt.system + prompt.user);
        const o = res.usage.outputTokens ?? estimateTokens(res.text);
        model = res.model;
        input += i;
        output += o;
        micros += costMicros(res.model, i, o, res.usage.cachedInputTokens ?? 0).micros;
      }
      if (model) usage = { model: model.slice(0, 80), inputTokens: input, outputTokens: output, costMicros: BigInt(micros) };
      const validation = {
        own: own.evidence.domain,
        competitors: readable.slice(1).map((m) => m.evidence.domain),
        pages: Object.fromEntries(readable.map((m) => [m.evidence.domain, m.digest!.pages.map((p) => p.url)])),
      };
      const compared = !compare.ok ? null : compare.truncated ? ({ ok: false, reason: 'cut off' } as const) : validateCompare(compare.text, validation);
      const profiled = !profiles.ok || profiles.truncated ? null : validateProfiles(profiles.text, validation);
      if (!compare.ok) this.logger.warn({ msg: 'competitor_analyzer.ai_failed', companyId, studyId, code: compare.code });
      if (compared?.ok) {
        const measuredScores = deterministicComparison(readable.map((item) => item.evidence));
        const candidate: AnalyzerResult = { ...compared.result, ...measuredScores, ...(profiled?.ok ? profiled.result : EMPTY_PROFILES) };
        const checkedRecommendations = validateRecommendations(candidate, own.evidence);
        const result = checkedRecommendations.result;
        ai = {
          status: 'completed',
          promptVersion: ANALYZER_PROMPT_VERSION,
          generatedAt: new Date().toISOString(),
          dropped: compared.dropped + (profiled?.ok ? profiled.dropped : 0) + checkedRecommendations.dropped,
          profiles: profiled?.ok ? 'completed' : 'failed',
          result,
        };
      } else {
        const failureCode=compare.ok?(compare.truncated?'truncated':compared&&!compared.ok?compared.reason:'validation_failed'):compare.code;
        this.logger.warn({msg:'competitor_analyzer.comparison_incomplete',companyId,studyId,code:failureCode});
        const reservationExhausted=!compare.ok&&compare.code==='rate_limited'&&/reservation budget/i.test(compare.message);
        const reasons:Record<string,string>={rate_limited:reservationExhausted?'The daily AI reservation budget has insufficient capacity for this comparison. It resets at 00:00 UTC (05:30 IST).':'The AI provider is rate limiting requests.',auth:'The AI provider rejected its credentials.',billing:'The AI provider rejected the request because of billing or quota.',timeout:'The AI provider timed out.',not_configured:'The AI provider is not configured.',model_unavailable:'The configured AI model is unavailable.',truncated:'The AI response exceeded its output limit.'};
        ai = { status: 'failed', failureCode, reason: `${reasons[failureCode]??'The AI comparison did not pass the response checks.'} Measured website scores remain available; narrative insights are incomplete.` };
      }
      // Saved even when the comparison failed: these facts are checked word for word against the pages on their own.
      const offersChecked = offersRes?.ok && !offersRes.truncated ? validateOffers(offersRes.text, offersInput) : null;
      const offers: OffersBlock = !wantOffers
        ? { status: 'completed', promptVersion: OFFERS_PROMPT_VERSION, generatedAt: new Date().toISOString(), sites: offersInput.map((site) => emptyOffers(site.domain)), dropped: 0 }
        : offersChecked
          ? { status: 'completed', promptVersion: OFFERS_PROMPT_VERSION, generatedAt: new Date().toISOString(), sites: offersChecked.sites, dropped: offersChecked.dropped }
          : { status: 'failed', promptVersion: OFFERS_PROMPT_VERSION, generatedAt: new Date().toISOString(), sites: [], dropped: 0, reason: 'The offers could not be read this time. Re-check to try again.' };
      ai.offers = offers;
    }

    await saveProfileResults(runId, study.profile ?? 'general-v1', evidence, this.repository);
    if(!ai.result)ai.result=measuredAnalysis(evidence);
    const completedAnalysis = ai.result as AnalyzerResult;
    ai.quality = assessQuality(evidence, completedAnalysis);

    // 3. What changed since the last completed run.
    const previous = await this.repository.competitorStudyRun.findFirst({ where: { studyId, companyId, status: 'completed', id: { not: runId } }, orderBy: { startedAt: 'desc' } });
    const overall = ((ai as any).result?.overall ?? null) as Record<string, number> | null;
    const changes = previous
      ? {
          since: previous.finishedAt ?? previous.startedAt,
          items: diffRuns(
            { sites: (previous.sites ?? []) as unknown as SiteEvidence[], overall: (previous.ai as any)?.result?.overall ?? null, offers: completedOffers((previous.ai as any)?.offers) },
            { sites: evidence, overall, offers: completedOffers((ai as any).offers) },
          ),
        }
      : null;

    const crawlUsage={...allocation.budget,allocatedPages:allocation.pages,contentPages:evidence.reduce((count,site)=>count+site.pages.length,0),httpRequests};
    const businessIntelligence=buildBusinessIntelligence({profileId:study.profile,sites:evidence,analysis:completedAnalysis,offers:ai.offers as OffersBlock|undefined,previous:previous?.businessIntelligence as BusinessIntelligence|undefined,budget:crawlUsage});
    if(changes&&businessIntelligence?.changes.length)changes.items.push(...businessIntelligence.changes.slice(0,15).map(change=>({domain:change.domain,kind:'content' as const,direction:'neutral' as const,text:`${change.section}: ${change.message}`})));
    const saved = await this.repository.competitorStudyRun.updateMany({
      where: { id: runId, status: 'running' },
      data: { businessIntelligence,crawlUsage,status: 'completed', stage: null, finishedAt: new Date(), sites: evidence as never, ai: ai as never, changes: changes as never, ...usage },
    });
    if (!saved.count) {
      // Stopped during the AI step: the result is not kept, but what the AI already cost still counts in the budget.
      if (usage.costMicros) await this.repository.competitorStudyRun.update({ where: { id: runId }, data: { model: usage.model, inputTokens: usage.inputTokens, outputTokens: usage.outputTokens, costMicros: usage.costMicros } });
      this.logger.log({ msg: 'competitor_analyzer.stopped_after_ai', companyId, studyId, runId, micros: usage.costMicros ? Number(usage.costMicros) : 0 });
      return;
    }
    await this.refreshNames(studyId, evidence);
    this.logger.log({ msg: 'competitor_analyzer.completed', companyId, studyId, runId, trigger, sites: evidence.length, ai: ai.status, micros: usage.costMicros ? Number(usage.costMicros) : 0 });

    // 4. A scheduled check that found changes tells the team (in-app) and, if switched on, the report e-mails.
    if (trigger === 'scheduled' && changes?.items.length) await this.alert(companyId, study, changes.items);
  }

  private studyLink(studyId: string) {
    const base = (process.env.ADMIN_APP_URL || process.env.APP_BASE_URL || '').replace(/\/$/, '');
    return base ? `${base}/competitor-analyzer/${studyId}` : null;
  }

  private async alert(companyId: string, study: CompetitorStudy, items: SiteChange[]) {
    const owners = await Admin.find({ role: 'superadmin', isActive: true }).select('_id').lean();
    const userIds = [...new Set([study.createdByUserId, ...owners.map(o => String(o._id))].filter(Boolean))];
    if (userIds.length) await Alert.insertMany(userIds.map(userId => ({
      companyId, userId, type: 'competitor_changes', title: `${items.length} competitor changes`,
      message: items.slice(0, 3).map(c => `${c.domain}: ${c.text}`).join(' · '), data: { studyId: study.id, items },
    })));
    const settings = readSettings(study.settings);
    if (!settings.alerts || !settings.reportEmails.length || !this.email) return;
    const mail = changesEmail({ studyName: study.name, changes: items, link: this.studyLink(study.id) });
    for (const to of settings.reportEmails) {
      await this.email.send({ companyId, to, ...mail }).catch((error) => this.logger.warn({ msg: 'competitor_analyzer.alert_email_failed', companyId, studyId: study.id, error: error instanceof Error ? error.message : 'unknown' }));
    }
  }

  /* ------------------------------------------------------------------ */
  /* Keeping watch: settings, scheduler hooks                            */
  /* ------------------------------------------------------------------ */

  async updateSettings(t: TenantContext, id: string, dto: Partial<StudySettings>) {
    const companyId = this.companyId(t);
    const study = await this.study(companyId, id);
    const before = readSettings(study.settings);
    const bad = (dto.reportEmails ?? []).find((e) => !validEmail(e));
    if (bad) throw new BadRequestException({ message: `“${bad}” is not an e-mail address.`, reason: 'invalid_email' });
    const next = readSettings({ ...before, ...dto });
    if ((next.alerts || next.reportMonthly) && !next.reportEmails.length) throw new BadRequestException({ message: 'Add at least one e-mail address for alerts or the monthly report.', reason: 'no_email' });
    await this.repository.competitorStudy.update({
      where: { id: study.id },
      data: {
        settings: next as never,
        nextCheckAt: next.schedule === before.schedule && study.nextCheckAt ? study.nextCheckAt : nextCheckAt(next.schedule),
        nextReportAt: next.reportMonthly ? (before.reportMonthly && study.nextReportAt ? study.nextReportAt : nextReportAt()) : null,
      },
    });
    return this.detail(t, id);
  }

  /** Called by the scheduler: starts every check that is due and moves its next date on. Claims are atomic. */
  async runDueChecks(limit = 5) {
    const now = new Date();
    const due = await this.repository.competitorStudy.findMany({ where: { archivedAt: null, nextCheckAt: { lte: now } }, orderBy: { nextCheckAt: 'asc' }, take: limit });
    let started = 0;
    for (const study of due) {
      const settings = readSettings(study.settings);
      const next = nextCheckAt(settings.schedule, now);
      if (settings.schedule === 'off') continue;
      try {
        // Persist the run before moving the schedule. A crash cannot lose the due check.
        if (await this.startRun(study.companyId, study, 'scheduled')) started += 1;
        await this.repository.competitorStudy.updateMany({ where: { id: study.id, nextCheckAt: study.nextCheckAt }, data: { nextCheckAt: next } });
      } catch (error) {
        this.logger.warn({ msg: 'competitor_analyzer.scheduled_start_failed', studyId: study.id, error: error instanceof Error ? error.message : 'unknown' });
      }
    }
    return started;
  }

  /** Called by the scheduler: e-mails the monthly PDF for every study that is due. */
  async sendDueReports(limit = 3) { return enqueueDueReports(limit); }

  /* ------------------------------------------------------------------ */
  /* Action plan progress                                                */
  /* ------------------------------------------------------------------ */

  async setActionStatus(t: TenantContext, id: string, dto: { action: string; status: ActionStatus }) {
    const companyId = this.companyId(t);
    const study = await this.study(companyId, id);
    const actions = readActions(study.actions);
    const key = actionKey(dto.action);
    actions[key] = { ...(actions[key] ?? { taskId: null }), status: dto.status, action: dto.action.slice(0, 300), updatedAt: new Date().toISOString(), updatedBy: t.userId };
    await this.repository.competitorStudy.update({ where: { id: study.id }, data: { [`actions.${key}`]: actions[key] } });
    return { key, state: actions[key] };
  }

  /** Turns an action into a CRM task for the linked client and marks it in progress. */
  async createActionTask(t: TenantContext, id: string, dto: { action: string; reason?: string; priority?: 'high' | 'medium' | 'low'; dueDate?: string }) {
    const companyId = this.companyId(t);
    const study = await this.study(companyId, id);
    const client = await this.clientFor(companyId, study);
    if (!client) throw new ConflictException({ message: 'Link this analysis to one of your clients (a client whose website is your site) to create CRM tasks.', reason: 'no_client' });
    const actions = readActions(study.actions);
    const key = actionKey(dto.action);
    if (actions[key]?.taskId) return { key, state: actions[key], taskId: actions[key]!.taskId, created: false };
    const title = dto.action.trim().slice(0, 200);
    await Task.init();
    const task = await Task.findOneAndUpdate({ companyId, studyId: study.id, actionKey: key }, {
      $setOnInsert: { companyId, studyId: study.id, actionKey: key, clientId: client.id, name: title, status: 'pending',
        payload: { description: dto.reason, priority: dto.priority ?? 'medium', dueDate: dto.dueDate ?? null } },
    }, { upsert: true, returnDocument: 'after' });
    actions[key] = { status: actions[key]?.status === 'done' ? 'done' : 'doing', action: title, taskId: String(task._id), updatedAt: new Date().toISOString(), updatedBy: t.userId };
    await this.repository.competitorStudy.update({ where: { id: study.id }, data: { [`actions.${key}`]: actions[key] } });
    return { key, state: actions[key], taskId: String(task._id), created: true };
  }

  /* ------------------------------------------------------------------ */
  /* PDF report                                                          */
  /* ------------------------------------------------------------------ */

  /**
   * The PDF report of the latest completed check. Its written narrative is generated once per run (a paid AI call inside
   * the daily budget) and saved on the run, so later downloads are free and identical.
   */
  async reportPdf(t: TenantContext, id: string, lang: ReportLang = 'en'): Promise<{ fileName: string; content: Buffer }> {
    const companyId = this.companyId(t);
    const study = await this.study(companyId, id);
    const { fileName, content } = await this.buildPdf(companyId, study, lang);
    return { fileName, content };
  }

  /** E-mails the PDF to up to five addresses now. */
  async emailReport(t: TenantContext, id: string, to: string[]) {
    const companyId = this.companyId(t);
    const study = await this.study(companyId, id);
    const list = [...new Set(to.map((e) => e.trim().toLowerCase()))];
    const bad = list.find((e) => !validEmail(e));
    if (bad) throw new BadRequestException({ message: `“${bad}” is not an e-mail address.`, reason: 'invalid_email' });
    const now = Date.now();
    const recent = (emails.get(study.id) ?? []).filter((at) => now - at < 86_400_000);
    if (recent.length >= EMAILS_PER_DAY) throw new HttpException({ message: 'This report was e-mailed many times today. Try again tomorrow.', reason: 'rate_limited' }, HttpStatus.TOO_MANY_REQUESTS);
    emails.set(study.id, [...recent, now]);
    const sent = await this.mailReport(companyId, study, list);
    return { sent, to: list };
  }

  private async mailReport(companyId: string, study: CompetitorStudy, to: string[]) {
    if (!this.email) throw new ServiceUnavailableException({ message: 'E-mail is not set up on this server.', reason: 'email_unavailable' });
    const pdf = await this.buildPdf(companyId, study);
    const mail = reportEmail({ studyName: study.name, ownDomain: (study.sites as unknown as StudySite[])[0]!.domain, headline: pdf.headline, score: pdf.score, rank: pdf.rank, total: pdf.total, link: this.studyLink(study.id) });
    let sent = 0;
    for (const address of to) {
      await this.email.send({ companyId, to: address, ...mail, attachments: [{ filename: pdf.fileName, content: pdf.content, contentType: 'application/pdf' }] });
      sent += 1;
    }
    this.logger.log({ msg: 'competitor_analyzer.report_emailed', companyId, studyId: study.id, recipients: sent });
    return sent;
  }

  private async buildPdf(companyId: string, study: CompetitorStudy, lang: ReportLang = 'en') {
    const run = await this.repository.competitorStudyRun.findFirst({ where: { studyId: study.id, companyId, status: 'completed' }, orderBy: { startedAt: 'desc' } });
    if (!run) throw new ConflictException({ message: 'Run the analysis once before downloading the report.', reason: 'no_report' });
    const company = organisation();
    const sites = study.sites as unknown as StudySite[];
    const evidence = (run.sites ?? []) as unknown as SiteEvidence[];
    const block = (run.ai ?? null) as { status?: string; reason?: string; result?: AnalyzerResult; narrative?: { promptVersion: string; result: ReportNarrative }; offers?: OffersBlock } | null;
    const ai = buildCanonicalReportModel(run).analysis;
    const model = buildCanonicalReportModel(run);

    const narrative = null;

    // Hindi: the analysis text is translated once per run and saved; the PDF's own labels come from a dictionary.
    let text: Translatable = { ai, narrative, changes: (run.changes as { items?: SiteChange[] } | null)?.items ?? null };
    let business=model.businessIntelligence;
    if (lang === 'hi') {
      const strings = [...collectStrings(text),...businessStrings(business)];
      const map = strings.length ? await this.hindiFor(companyId, run.id, strings) : {};
      if (strings.length && !Object.keys(map).length) {
        throw new ServiceUnavailableException({ message: 'The Hindi report could not be prepared right now (the AI translation is unavailable or today’s AI budget is used up). Try again later or download the English report.', reason: 'translation_unavailable' });
      }
      text = applyTranslations(text, map);
      business=translateBusiness(business,map);
    }

    const content = await renderAnalyzerPdf({
      studyName: study.name,
      brandName: company.name,
      profileResults: run.profileResults,
      businessIntelligence:business,
      preparedFor: company?.name ?? 'your company',
      logo: await this.logoPng(company?.reportLogoAsset ?? company?.logoAsset ?? null) ?? await localReportLogo(),
      generatedAt: new Date(),
      checkedAt: run.finishedAt ?? run.startedAt,
      sites,
      evidence,
      quality: model.quality,
      businessThreat: model.businessThreat,
      canonicalSummary: model.summary,
      ai: text.ai,
      aiNote: block?.status === 'completed' ? null : block?.reason ?? null,
      narrative: text.narrative,
      changes: text.changes,
      offers: block?.offers ?? null,
      lang,
    });
    const day = (run.finishedAt ?? run.startedAt).toISOString().slice(0, 10);
    const own = sites[0]!.domain;
    const score = ai?.overall[own] ?? null;
    const rank = ai && score != null ? Object.values(ai.overall).filter((v) => v > score).length + 1 : null;
    return { fileName: `competitor-report-${lang === 'hi' ? 'hindi-' : ''}${own}-${day}.pdf`.replace(/[^A-Za-z0-9._-]/g, '_'), content, headline: model.businessIntelligence?.summary ?? model.summary, score, rank, total: sites.length };
  }

  /** The company's report logo as PNG/JPEG bytes (Cloudinary converts on request); null when there is none or it fails. */
  private async logoPng(asset: { secureUrl: string; format: string } | null): Promise<Buffer | null> {
    if (!asset?.secureUrl) return null;
    try {
      const url = new URL(asset.secureUrl);
      if (url.protocol !== 'https:' || !/(^|\.)cloudinary\.com$/.test(url.hostname)) return null;
      const converted = /^(png|jpe?g)$/i.test(asset.format) ? url.href : url.href.replace('/upload/', '/upload/f_png,w_480,c_limit/');
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 10_000);
      try {
        const res = await fetch(converted, { signal: controller.signal });
        if (!res.ok) return null;
        const bytes = Buffer.from(await res.arrayBuffer());
        const png = bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
        const jpeg = bytes[0] === 0xff && bytes[1] === 0xd8;
        return bytes.length < 3_000_000 && (png || jpeg) ? bytes : null;
      } finally {
        clearTimeout(timer);
      }
    } catch {
      return null;
    }
  }

  /** One Hindi translation per run even when the report is downloaded twice at once. */
  private readonly translations = new Map<string, Promise<Record<string, string>>>();

  /**
   * Hindi text for the run's analysis, by string id. Saved on the run (`ai.hi`) so later downloads are free; only ids
   * that passed validation are kept, and anything missing is drawn in English.
   */
  private hindiFor(companyId: string, runId: string, strings: { id: string; text: string }[]) {
    const pending = this.translations.get(runId);
    if (pending) return pending;
    const work = (async (): Promise<Record<string, string>> => {
      const saved = (await this.repository.competitorStudyRun.findUnique({ where: { id: runId }, select: { ai: true } }))?.ai as { hi?: { promptVersion: string; map: Record<string, string> } } | null;
      const cached = saved?.hi?.promptVersion === HINDI_PROMPT_VERSION ? saved.hi.map : {};
      const todo = strings.filter((s) => !cached[s.id]);
      if (!todo.length) return cached;
      if (aiLimits.defaultMode() === 'disabled' || !providerKey('openai')) return cached;
      if ((await this.spendToday(companyId)) >= aiLimits.dailyBudgetMicros()) return cached;

      // Batches of about 5,000 characters, translated in parallel.
      const batches: { id: string; text: string }[][] = [];
      let size = 0;
      for (const item of todo) {
        if (!batches.length || size + item.text.length > 5_000) {
          batches.push([]);
          size = 0;
        }
        batches[batches.length - 1]!.push(item);
        size += item.text.length;
      }
      let input = 0;
      let output = 0;
      let micros = 0;
      const results = await Promise.all(
        batches.map(async (batch) => {
          const user = translateUserPrompt(batch);
          const res = await callProvider('openai', { system: TRANSLATE_SYSTEM, user, maxOutputTokens: 8_000, timeoutMs: AI_TIMEOUT_MS });
          if (!res.ok) {
            this.logger.warn({ msg: 'competitor_analyzer.hindi_failed', companyId, runId, code: res.code });
            return {};
          }
          const i = res.usage.inputTokens ?? estimateTokens(TRANSLATE_SYSTEM + user);
          const o = res.usage.outputTokens ?? estimateTokens(res.text);
          input += i;
          output += o;
          micros += costMicros(res.model, i, o, res.usage.cachedInputTokens ?? 0).micros;
          return res.truncated ? {} : validateTranslations(res.text, batch);
        }),
      );
      const map = Object.assign({}, cached, ...results) as Record<string, string>;
      const current = await this.repository.competitorStudyRun.findUnique({ where: { id: runId } });
      if (current) {
        await this.repository.competitorStudyRun.update({
          where: { id: runId },
          data: {
            ai: { ...((current.ai ?? {}) as object), hi: { promptVersion: HINDI_PROMPT_VERSION, generatedAt: new Date().toISOString(), map } } as never,
            costMicros: (current.costMicros ?? 0n) + BigInt(micros),
            outputTokens: (current.outputTokens ?? 0) + output,
            inputTokens: (current.inputTokens ?? 0) + input,
          },
        });
      }
      this.logger.log({ msg: 'competitor_analyzer.hindi_translated', companyId, runId, strings: todo.length, kept: Object.keys(map).length - Object.keys(cached).length, micros });
      return map;
    })().finally(() => this.translations.delete(runId));
    this.translations.set(runId, work);
    return work;
  }

  /** One narrative per run even when the report is downloaded twice at once. */
  private readonly narratives = new Map<string, Promise<ReportNarrative | null>>();

  private narrativeFor(companyId: string, runId: string, sites: StudySite[], evidence: SiteEvidence[], ai: AnalyzerResult) {
    const pending = this.narratives.get(runId);
    if (pending) return pending;
    const work = (async (): Promise<ReportNarrative | null> => {
      if (aiLimits.defaultMode() === 'disabled' || !providerKey('openai')) return null;
      if ((await this.spendToday(companyId)) >= aiLimits.dailyBudgetMicros()) return null;
      const prompt = buildReportPrompt({ own: sites[0]!.domain, sites: evidence, ai });
      const res = await callProvider('openai', { ...prompt, maxOutputTokens: 4_000, timeoutMs: AI_TIMEOUT_MS });
      if (!res.ok || res.truncated) {
        this.logger.warn({ msg: 'competitor_analyzer.report_text_failed', companyId, runId, code: res.ok ? 'truncated' : res.code });
        return null;
      }
      const input = res.usage.inputTokens ?? estimateTokens(prompt.system + prompt.user);
      const output = res.usage.outputTokens ?? estimateTokens(res.text);
      const micros = costMicros(res.model, input, output, res.usage.cachedInputTokens ?? 0).micros;
      const checked = validateReport(res.text, sites.slice(1).map((s) => s.domain));
      const current = await this.repository.competitorStudyRun.findUnique({ where: { id: runId } });
      if (!current) return null;
      await this.repository.competitorStudyRun.update({
        where: { id: runId },
        data: {
          ai: checked.ok ? ({ ...((current.ai ?? {}) as object), narrative: { promptVersion: REPORT_PROMPT_VERSION, generatedAt: new Date().toISOString(), result: checked.result } } as never) : undefined,
          costMicros: (current.costMicros ?? 0n) + BigInt(micros),
          outputTokens: (current.outputTokens ?? 0) + output,
          inputTokens: (current.inputTokens ?? 0) + input,
        },
      });
      return checked.ok ? checked.result : null;
    })().finally(() => this.narratives.delete(runId));
    this.narratives.set(runId, work);
    return work;
  }

  /**
   * Competitors for a website: the AI names likely competitors from the home page, then each one is checked (the
   * website it gives must open, or Google's Knowledge Graph must list one for the name). `scope` picks the area (the
   * client's city, state or whole country) and `place` overrides the location read from the site. Results are kept 7
   * days per website, area and place.
   */
  async suggest(t: TenantContext, url: string, scope: SuggestScope, placeInput?: string, requestedProfile?:string) {
    const profile=requestedProfile??await defaultProfileFor(url);
    if(profile==='expo-organic-v1')return enqueueDiscovery(this.companyId(t),url,scope,placeInput??'',profile);
    const companyId = this.companyId(t);
    const site = normalizeSite(url);
    if (!site) throw new BadRequestException({ message: `“${url}” is not a website address.`, reason: 'invalid_site' });
    const place = (placeInput ?? '').replace(/\s+/g, ' ').trim().slice(0, 120);
    const cached = await this.repository.competitorSuggestion.findFirst({
      where: {
        companyId,
        domain: site.domain,
        createdAt: { gte: new Date(Date.now() - SUGGESTION_CACHE_MS) },
        AND: [{ result: { path: ['scope'], equals: scope } }, { result: { path: ['place'], equals: place.toLowerCase() } }, { result: { path: ['promptVersion'], equals: SUGGEST_PROMPT_VERSION } }],
      },
      orderBy: { createdAt: 'desc' },
    });
    if (cached) return { ...(cached.result as unknown as SuggestionResult), cached: true, at: cached.createdAt };

    const now = Date.now();
    const recent = (suggests.get(companyId) ?? []).filter((at) => now - at < 60 * 60 * 1000);
    if (recent.length >= SUGGESTS_PER_HOUR) throw new HttpException({ message: 'Too many competitor suggestions this hour. Try again later.', reason: 'rate_limited' }, HttpStatus.TOO_MANY_REQUESTS);
    if (aiLimits.defaultMode() === 'disabled' || !providerKey('openai')) throw new ServiceUnavailableException({ message: 'Competitor suggestions need AI, which is not set up on this server. Type competitor names or websites instead.', reason: 'ai_unavailable' });
    if ((await this.spendToday(companyId)) >= aiLimits.dailyBudgetMicros()) throw new HttpException({ message: 'Today’s AI limit for this company is used up. Try again tomorrow, or type competitors yourself.', reason: 'budget_exceeded' }, HttpStatus.TOO_MANY_REQUESTS);
    suggests.set(companyId, [...recent, now]);

    const deps = networkDeps();
    const home = await readHomeSummary(site.url, deps);
    if (!home.reachable || (!home.title && !home.text)) throw new BadRequestException({ message: 'Your website did not answer, so competitors cannot be suggested. Check the address.', reason: 'site_unreachable' });
    const prompt = { system: SUGGEST_SYSTEM, user: suggestUserPrompt({ domain: site.domain, title: home.title, description: home.description, headings: home.headings, text: home.text, clues: home.clues, scope, place }) };
    const res = await callProvider('openai', { ...prompt, maxOutputTokens: 1_500, timeoutMs: AI_TIMEOUT_MS });
    if (!res.ok) throw new ServiceUnavailableException({ message: 'The AI could not suggest competitors right now. Try again in a minute.', reason: 'ai_failed' });
    const input = res.usage.inputTokens ?? estimateTokens(prompt.system + prompt.user);
    const output = res.usage.outputTokens ?? estimateTokens(res.text);
    const micros = costMicros(res.model, input, output, res.usage.cachedInputTokens ?? 0).micros;
    const answer = validateSuggest(res.text, site.domain);

    // Every name must lead to a website that opens: the AI's own guess first, then Google's Knowledge Graph.
    const kgKey = knowledgeGraphApiKey();
    const checked = await Promise.all(
      (answer?.candidates ?? []).map(async (c): Promise<CompetitorSuggestionItem | null> => {
        const tryUrl = async (candidate: string, source: CompetitorSuggestionItem['source']) => {
          const s = normalizeSite(candidate);
          if (!s || s.domain === site.domain || isIgnoredHost(s.domain)) return null;
          const probe = await probeSiteName(s.url, deps);
          // The site must stay on its own address (ayurvedaworld.org forwarded to a spam site) and carry the competitor's
          // name (in its domain or its own name), not just open.
          if (!probe.reachable || probe.movedTo || !nameMatchesSite(c.name, s.domain, probe.name)) return null;
          return { name: c.name, domain: s.domain, url: s.url, siteName: cleanName(probe.name), why: c.why, source };
        };
        const direct = c.website ? await tryUrl(c.website, 'ai') : null;
        if (direct) return direct;
        // Only a Knowledge Graph entry with the same name counts: the first hit for "Design My Space" was Samsung.
        const found = await searchEntities(c.name, { apiKey: kgKey }).catch(() => null);
        const entity = found?.ok ? found.entities.find((e) => e.url && nameMatchesSite(c.name, normalizeSite(e.url)?.domain ?? '', e.name)) : undefined;
        return entity?.url ? tryUrl(entity.url, 'knowledge_graph') : null;
      }),
    );
    const seen = new Set<string>();
    const suggestions = checked.filter((s): s is CompetitorSuggestionItem => {
      if (!s || seen.has(s.domain)) return false;
      seen.add(s.domain);
      return true;
    }).slice(0, MAX_SUGGESTIONS);
    const result: SuggestionResult = { business: answer?.business ?? { what: '', where: null }, scope, place: place.toLowerCase(), area: answer?.area ?? null, suggestions, dropped: (answer?.candidates.length ?? 0) - suggestions.length };

    // Saved even when the answer was unreadable, so its cost counts in the daily AI budget.
    const saved = await this.repository.competitorSuggestion.create({
      data: { companyId, domain: answer ? site.domain : `invalid:${site.domain}`.slice(0, 255), result: { ...result, promptVersion: SUGGEST_PROMPT_VERSION } as never, model: res.model.slice(0, 80), inputTokens: input, outputTokens: output, costMicros: BigInt(micros) },
    });
    this.logger.log({ msg: 'competitor_analyzer.suggested', companyId, domain: site.domain, scope, place, suggestions: suggestions.length, dropped: result.dropped, micros });
    if (!answer) throw new ServiceUnavailableException({ message: 'The AI answer could not be read. Try again in a minute.', reason: 'ai_invalid' });
    return { ...result, cached: false, at: saved.createdAt };
  }

  /**
   * Every location a website states (venue, shop, branch, office…) with the main customer-facing one first, read from
   * its home page and up to 4 contact / about / location pages by one AI call; each place must be quoted from those
   * pages. The area choice names the main place. Kept 7 days per website.
   */
  async location(t: TenantContext, url: string) {
    const companyId = this.companyId(t);
    const site = normalizeSite(url);
    if (!site) throw new BadRequestException({ message: `“${url}” is not a website address.`, reason: 'invalid_site' });
    const key = `location:${site.domain}`;
    const cached = await this.repository.competitorSuggestion.findFirst({
      where: { companyId, domain: key, createdAt: { gte: new Date(Date.now() - SUGGESTION_CACHE_MS) }, result: { path: ['promptVersion'], equals: LOCATION_PROMPT_VERSION } },
      orderBy: { createdAt: 'desc' },
    });
    if (cached) return { ...(cached.result as unknown as SiteLocation), cached: true };

    const now = Date.now();
    const recent = (locationReads.get(companyId) ?? []).filter((at) => now - at < 60 * 60 * 1000);
    if (recent.length >= LOCATIONS_PER_HOUR) throw new HttpException({ message: 'Too many location checks this hour. Type your location instead.', reason: 'rate_limited' }, HttpStatus.TOO_MANY_REQUESTS);
    if (aiLimits.defaultMode() === 'disabled' || !providerKey('openai')) throw new ServiceUnavailableException({ message: 'Reading the location needs AI, which is not set up on this server. Type your location instead.', reason: 'ai_unavailable' });
    if ((await this.spendToday(companyId)) >= aiLimits.dailyBudgetMicros()) throw new HttpException({ message: 'Today’s AI limit for this company is used up. Type your location instead.', reason: 'budget_exceeded' }, HttpStatus.TOO_MANY_REQUESTS);
    locationReads.set(companyId, [...recent, now]);

    const read = await readSiteLocations(site.url, networkDeps());
    if (!read.reachable || (!read.title && !read.text && !read.clues)) throw new BadRequestException({ message: 'Your website did not answer, so its location cannot be read.', reason: 'site_unreachable' });
    const prompt = { system: LOCATION_SYSTEM, user: locationUserPrompt({ domain: site.domain, title: read.title, description: read.description, text: read.text, clues: read.clues }) };
    const res = await callProvider('openai', { ...prompt, maxOutputTokens: 1_200, timeoutMs: AI_TIMEOUT_MS });
    if (!res.ok) throw new ServiceUnavailableException({ message: 'The location could not be read right now. Type it instead.', reason: 'ai_failed' });
    const input = res.usage.inputTokens ?? estimateTokens(prompt.system + prompt.user);
    const output = res.usage.outputTokens ?? estimateTokens(res.text);
    const micros = costMicros(res.model, input, output, res.usage.cachedInputTokens ?? 0).micros;
    const parsed = validateLocation(res.text, prompt.user);
    const location = parsed ? { ...parsed, pages: read.pages } : null;
    // Saved even when unreadable, so the cost counts in the daily AI budget.
    await this.repository.competitorSuggestion.create({
      data: { companyId, domain: (location ? key : `invalid:${key}`).slice(0, 255), result: { ...(location ?? {}), promptVersion: LOCATION_PROMPT_VERSION } as never, model: res.model.slice(0, 80), inputTokens: input, outputTokens: output, costMicros: BigInt(micros) },
    });
    this.logger.log({ msg: 'competitor_analyzer.location', companyId, domain: site.domain, pages: read.pages.length, places: location?.places.length, city: location?.city, micros });
    if (!location) throw new ServiceUnavailableException({ message: 'The location could not be read. Type it instead.', reason: 'ai_invalid' });
    return { ...location, cached: false };
  }

  /** Business name → websites Google's Knowledge Graph lists for it, to pick a competitor without knowing its domain. */
  async lookup(t: TenantContext, q: string) {
    const companyId = this.companyId(t);
    const now = Date.now();
    const recent = (lookups.get(companyId) ?? []).filter((at) => now - at < 60 * 60 * 1000);
    if (recent.length >= LOOKUPS_PER_HOUR) throw new HttpException({ message: 'Too many business searches this hour. Try again later.', reason: 'rate_limited' }, HttpStatus.TOO_MANY_REQUESTS);
    lookups.set(companyId, [...recent, now]);
    const result = await searchEntities(q.trim(), { apiKey: knowledgeGraphApiKey() });
    if (!result.ok) return { results: [], message: result.failure.message };
    return {
      results: result.entities
        .filter((e) => e.url)
        .slice(0, 8)
        .map((e) => ({ name: e.name, description: e.description, url: e.url, domain: normalizeSite(e.url!)?.domain ?? null, imageUrl: e.imageUrl })),
      message: null,
    };
  }
}
