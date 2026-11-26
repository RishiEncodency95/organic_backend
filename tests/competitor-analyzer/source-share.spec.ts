import { describe, expect, it, vi } from 'vitest';
import { CompetitorShareService } from '../../src/modules/competitor-analyzer/competitor-share.service';

const t = { companyId: 'co1', userId: 'u1' } as never;
const day = 86_400_000;

function share(over: Record<string, unknown> = {}) {
  return { id: 's1', companyId: 'co1', studyId: 'st1', token: 'A'.repeat(32), label: null, lang: 'en', expiresAt: new Date(Date.now() + day), revokedAt: null, viewCount: 0, lastViewedAt: null, createdByUserId: 'u1', createdAt: new Date(), ...over };
}

function setup(opts: { completed?: number; active?: number; found?: ReturnType<typeof share> | null } = {}) {
  const prisma = {
    competitorStudy: { findFirst: vi.fn(async () => ({ id: 'st1' })) },
    competitorStudyRun: { count: vi.fn(async () => opts.completed ?? 1) },
    competitorStudyShare: {
      count: vi.fn(async () => opts.active ?? 0),
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => share(data)),
      findUnique: vi.fn(async () => (opts.found === undefined ? share() : opts.found)),
      findFirst: vi.fn(async () => share()),
      update: vi.fn(async ({ data }: { data: Record<string, unknown> }) => share(data)),
      findMany: vi.fn(async () => [share()]),
    },
    company: { findUnique: vi.fn(async () => ({ name: 'Encodency' })) },
  };
  const analyzer = { sharedDetail: vi.fn(async () => ({ id: 'shared', report: null })), sharedPdf: vi.fn(async () => ({ fileName: 'r.pdf', content: Buffer.from('x') })) };
  return { prisma, analyzer, service: new CompetitorShareService(prisma as never, analyzer as never) };
}

describe('share links', () => {
  it('makes a 32-character link that ends after the chosen days', async () => {
    const { service, prisma } = setup();
    const made = await service.create(t, 'st1', { days: 30, lang: 'hi', label: '  Ramesh  ' });
    expect(made.token).toMatch(/^[A-Za-z0-9_-]{32}$/);
    expect(made).toMatchObject({ status: 'active', lang: 'hi', label: 'Ramesh' });
    const data = prisma.competitorStudyShare.create.mock.calls[0]![0].data as { expiresAt: Date };
    expect(Math.round((data.expiresAt.getTime() - Date.now()) / day)).toBe(30);
  });

  it('refuses odd durations, studies without a report and too many live links', async () => {
    await expect(setup().service.create(t, 'st1', { days: 365 })).rejects.toThrow('Choose 7, 30 or 90 days.');
    await expect(setup({ completed: 0 }).service.create(t, 'st1', { days: 7 })).rejects.toThrow('Run the analysis once');
    await expect(setup({ active: 10 }).service.create(t, 'st1', { days: 7 })).rejects.toThrow('already has 10 active links');
  });

  it('opens a live link without login and counts the view', async () => {
    const { service, prisma, analyzer } = setup();
    const out = await service.publicView('A'.repeat(32));
    expect(out.share.preparedBy).toBe(process.env.COMPETITOR_ORGANISATION_NAME ?? 'Bharat Organic Expo');
    expect(analyzer.sharedDetail).toHaveBeenCalledWith('co1', 'st1');
    expect(prisma.competitorStudyShare.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ viewCount: { increment: 1 } }) }));
  });

  it('answers 404 for unknown or malformed links and 410 for expired or switched-off ones', async () => {
    await expect(setup().service.publicView('short')).rejects.toMatchObject({ status: 404 });
    await expect(setup({ found: null }).service.publicView('B'.repeat(32))).rejects.toMatchObject({ status: 404 });
    await expect(setup({ found: share({ expiresAt: new Date(Date.now() - 1000) }) }).service.publicView('A'.repeat(32))).rejects.toMatchObject({ status: 410 });
    await expect(setup({ found: share({ revokedAt: new Date() }) }).service.publicPdf('A'.repeat(32), 'en')).rejects.toMatchObject({ status: 410 });
  });

  it('switches a link off and reports it as such', async () => {
    const { service } = setup();
    expect((await service.revoke(t, 'st1', 's1')).status).toBe('revoked');
  });
});
