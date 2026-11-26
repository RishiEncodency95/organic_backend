import { z } from 'zod';
import { BadRequestException } from './errors';
import { PROFILE_IDS } from './industry-settings';

const site = z.string().trim().min(3).max(300);
const names = z.record(z.string().max(255), z.string().trim().max(120)).refine(v => Object.keys(v).length <= 9, 'At most nine site names');
export const crawlBudget=z.object({maxPagesPerSite:z.number().int().min(1).max(10),maxPagesPerRun:z.number().int().min(9).max(50),concurrency:z.number().int().min(1).max(2),maxHttpRequests:z.number().int().min(20).max(150)}).strict();
export const createStudy = z.object({ name: z.string().trim().max(120).optional(), own: site, competitors: z.array(site).min(1).max(8), clientId: z.string().uuid().optional(), names: names.optional(), profile: z.enum(PROFILE_IDS).optional(),crawlBudget:crawlBudget.optional() }).strict();
export const updateStudy = createStudy.omit({ clientId: true }).partial().strict();
export const settings = z.object({ schedule: z.enum(['off','weekly','monthly']).optional(), alerts: z.boolean().optional(), reportMonthly: z.boolean().optional(), reportEmails: z.array(z.email().max(254)).max(5).optional() }).strict();
export const action = z.object({ action: z.string().trim().min(2).max(300), status: z.enum(['todo','doing','done']) }).strict();
export const task = action.omit({ status:true }).extend({ reason:z.string().max(400).optional(), priority:z.enum(['high','medium','low']).optional(), dueDate:z.union([z.iso.datetime(),z.iso.date()]).optional() }).strict();
export const share = z.object({ days:z.union([z.literal(7),z.literal(30),z.literal(90)]), lang:z.enum(['en','hi']).optional(), label:z.string().trim().max(80).optional() }).strict();
export const email = z.object({ to:z.array(z.email().max(254)).min(1).max(5) }).strict();
export const urlQuery = z.object({ url:site }).strict();
export const suggestQuery = urlQuery.extend({ scope:z.enum(['city','state','country']).default('city'), place:z.string().trim().max(120).optional(),profile:z.enum(PROFILE_IDS).optional() }).strict();
export const industryPolicy=z.object({primaryWebsite:site,defaultProfile:z.enum(PROFILE_IDS),domainProfiles:z.record(z.string().min(3).max(255).regex(/^[a-z0-9.-]+$/),z.enum(PROFILE_IDS)),crawlBudget}).strict();
export const lookupQuery = z.object({ q:z.string().trim().min(2).max(120) }).strict();
export const client = z.object({ name:z.string().trim().min(1).max(120), website:site }).strict();
export function parse<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success) throw new BadRequestException({ message: result.error.issues.map(i=>`${i.path.join('.')}: ${i.message}`).join('; '), reason:'validation_failed' });
  return result.data;
}
export function uuid(value: unknown) { return parse(z.string().uuid(), value); }
