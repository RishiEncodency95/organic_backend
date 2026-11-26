import { BadRequestException, ForbiddenException, GoneException, HttpException, HttpStatus, NotFoundException, logger } from './errors';
import { AnalyzerRepository } from './repository';
import type { CompetitorStudyShare } from './models';
import { organisation, type TenantContext } from './adapters';
import { randomBytes } from 'node:crypto';
import type { ReportLang } from './analyzer-hindi';
import { CompetitorAnalyzerService } from './competitor-analyzer.service';

/** Links a company can hand to its client: the report without login, until it expires or is switched off. */
export const SHARE_DAYS = [7, 30, 90] as const;
const MAX_ACTIVE_PER_STUDY = 10;
const TOKEN = /^[A-Za-z0-9_-]{32}$/;
/** Per link, per hour: page views and PDF downloads (a PDF is built on every download). */
const VIEWS_PER_HOUR = 120;
const PDFS_PER_HOUR = 10;
const hits = new Map<string, number[]>();

function allow(key: string, limit: number) {
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((at) => now - at < 3_600_000);
  if (recent.length >= limit) return false;
  recent.push(now);
  hits.set(key, recent);
  return true;
}

export class CompetitorShareService {
  private readonly logger = logger;

  constructor(
    private readonly repository: AnalyzerRepository,
    private readonly analyzer: CompetitorAnalyzerService,
  ) {}

  private companyId(t: TenantContext) {
    if (!t.companyId) throw new ForbiddenException('A company context is required.');
    return t.companyId;
  }

  private async studyOf(companyId: string, studyId: string) {
    const study = await this.repository.competitorStudy.findFirst({ where: { id: studyId, companyId, archivedAt: null }, select: { id: true } });
    if (!study) throw new NotFoundException('Analysis not found.');
    return study;
  }

  private view(share: CompetitorStudyShare) {
    const now = Date.now();
    const status = share.revokedAt ? 'revoked' : share.expiresAt.getTime() <= now ? 'expired' : 'active';
    return {
      id: share.id,
      token: share.token,
      label: share.label,
      lang: share.lang as ReportLang,
      status,
      expiresAt: share.expiresAt,
      revokedAt: share.revokedAt,
      viewCount: share.viewCount,
      lastViewedAt: share.lastViewedAt,
      createdAt: share.createdAt,
    };
  }

  async list(t: TenantContext, studyId: string) {
    const companyId = this.companyId(t);
    await this.studyOf(companyId, studyId);
    const shares = await this.repository.competitorStudyShare.findMany({ where: { companyId, studyId }, orderBy: { createdAt: 'desc' }, take: 30 });
    return shares.map((s) => this.view(s));
  }

  async create(t: TenantContext, studyId: string, body: { days: number; lang?: string; label?: string }) {
    const companyId = this.companyId(t);
    await this.studyOf(companyId, studyId);
    if (!SHARE_DAYS.includes(body.days as (typeof SHARE_DAYS)[number])) throw new BadRequestException({ message: 'Choose 7, 30 or 90 days.', reason: 'invalid_days' });
    const hasReport = await this.repository.competitorStudyRun.count({ where: { studyId, companyId, status: 'completed' } });
    if (!hasReport) throw new BadRequestException({ message: 'Run the analysis once before sharing it.', reason: 'no_report' });
    const active = await this.repository.competitorStudyShare.count({ where: { companyId, studyId, revokedAt: null, expiresAt: { gt: new Date() } } });
    if (active >= MAX_ACTIVE_PER_STUDY) throw new BadRequestException({ message: `This analysis already has ${MAX_ACTIVE_PER_STUDY} active links. Switch one off first.`, reason: 'too_many_links' });
    const share = await this.repository.competitorStudyShare.create({
      data: {
        companyId,
        studyId,
        token: randomBytes(24).toString('base64url'),
        label: body.label?.trim().slice(0, 80) || null,
        lang: body.lang === 'hi' ? 'hi' : 'en',
        expiresAt: new Date(Date.now() + body.days * 86_400_000),
        createdByUserId: t.userId ?? null,
      },
    });
    this.logger.log({ msg: 'competitor_analyzer.share_created', companyId, studyId, shareId: share.id, days: body.days });
    return this.view(share);
  }

  async revoke(t: TenantContext, studyId: string, shareId: string) {
    const companyId = this.companyId(t);
    const share = await this.repository.competitorStudyShare.findFirst({ where: { id: shareId, studyId, companyId } });
    if (!share) throw new NotFoundException('Link not found.');
    const updated = share.revokedAt ? share : await this.repository.competitorStudyShare.update({ where: { id: share.id }, data: { revokedAt: new Date() } });
    this.logger.log({ msg: 'competitor_analyzer.share_revoked', companyId, studyId, shareId });
    return this.view(updated);
  }

  /** The live share behind a token; expired and switched-off links answer 410 so the page can say so. */
  private async active(token: string) {
    if (!TOKEN.test(token)) throw new NotFoundException('This link is not valid.');
    const share = await this.repository.competitorStudyShare.findUnique({ where: { token } });
    if (!share) throw new NotFoundException('This link is not valid.');
    if (share.revokedAt || share.expiresAt.getTime() <= Date.now()) {
      throw new GoneException({ message: 'This link has expired or was switched off. Ask the person who sent it for a new one.', reason: 'link_expired' });
    }
    return share;
  }

  async publicView(token: string) {
    const share = await this.active(token);
    if (!allow(`v:${share.id}`, VIEWS_PER_HOUR)) throw new HttpException({ message: 'This link was opened many times in the last hour. Try again later.', reason: 'rate_limited' }, HttpStatus.TOO_MANY_REQUESTS);
    const [study, company] = await Promise.all([
      this.analyzer.sharedDetail(share.companyId, share.studyId),
      Promise.resolve(organisation()),
    ]);
    await this.repository.competitorStudyShare.update({ where: { id: share.id }, data: { viewCount: { increment: 1 }, lastViewedAt: new Date() } });
    return { share: { preparedBy: company?.name ?? null, expiresAt: share.expiresAt, lang: share.lang as ReportLang }, study };
  }

  async publicPdf(token: string, lang: ReportLang) {
    const share = await this.active(token);
    if (!allow(`p:${share.id}`, PDFS_PER_HOUR)) throw new HttpException({ message: 'The PDF was downloaded many times in the last hour. Try again later.', reason: 'rate_limited' }, HttpStatus.TOO_MANY_REQUESTS);
    return this.analyzer.sharedPdf(share.companyId, share.studyId, lang);
  }
}