import mongoose, { Schema } from 'mongoose';
import { ORGANISATION_ID } from './adapters';
import { normalizeSite } from './analyzer-evidence';

export const PROFILE_IDS = ['general-v1', 'expo-v1', 'expo-organic-v1'] as const;
export type ProfileId = typeof PROFILE_IDS[number];
export interface CrawlBudget { maxPagesPerSite: number; maxPagesPerRun: number; concurrency: number; maxHttpRequests: number }
export const DEFAULT_CRAWL_BUDGET: CrawlBudget = { maxPagesPerSite: 10, maxPagesPerRun: 50, concurrency: 2, maxHttpRequests: 150 };
export const IndustrySettings = mongoose.model('AnalyzerIndustrySettings', new Schema({
  _id: String, primaryWebsite: String, defaultProfile: { type: String, enum: PROFILE_IDS, default: 'general-v1' }, domainProfiles: { type: Schema.Types.Mixed, default: () => ({}) },
  crawlBudget: { type: Schema.Types.Mixed, default: () => ({ ...DEFAULT_CRAWL_BUDGET }) }, updatedBy: String,
}, { timestamps: true, versionKey: false }));
export async function industrySettings() {
  const initial = { primaryWebsite: 'https://bharatorganicexpo.com/', defaultProfile: 'general-v1', domainProfiles: { 'bharatorganicexpo.com': 'expo-organic-v1' }, crawlBudget: DEFAULT_CRAWL_BUDGET };
  try { await IndustrySettings.updateOne({ _id: ORGANISATION_ID }, { $setOnInsert: initial }, { upsert: true }); }
  catch (error) { if ((error as { code?: number }).code !== 11000) throw error; }
  return (await IndustrySettings.findById(ORGANISATION_ID).lean())!;
}
export async function defaultProfileFor(url: string): Promise<ProfileId> {
  const settings = await industrySettings(), domain = normalizeSite(url)?.domain;
  const selected = domain ? (settings.domainProfiles as Record<string, ProfileId>)[domain] : undefined;
  return selected ?? settings.defaultProfile as ProfileId;
}
export function crawlAllocation(input: Partial<CrawlBudget> | undefined, siteCount: number) {
  const budget: CrawlBudget = { maxPagesPerSite: Math.max(1, Math.min(10, input?.maxPagesPerSite ?? 10)), maxPagesPerRun: Math.max(siteCount, Math.min(50, input?.maxPagesPerRun ?? 50)), concurrency: Math.max(1, Math.min(2, input?.concurrency ?? 2)), maxHttpRequests: Math.max(20, Math.min(150, input?.maxHttpRequests ?? 150)) };
  const pages = Array.from({ length: siteCount }, () => 1); let remaining = budget.maxPagesPerRun - siteCount;
  while (remaining > 0 && pages.some(count => count < budget.maxPagesPerSite)) for (let i = 0; i < pages.length && remaining > 0; i++) { if (pages[i]! < budget.maxPagesPerSite) { pages[i]++; remaining--; } }
  return { budget, pages };
}
export async function mapLimited<T, R>(items: readonly T[], concurrency: number, work: (item: T, index: number) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(items.length); let index = 0;
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, async () => { while (index < items.length) { const current = index++; results[current] = await work(items[current]!, current); } }));
  return results;
}
