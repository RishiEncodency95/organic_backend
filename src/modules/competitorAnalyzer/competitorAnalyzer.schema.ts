import { z } from "zod";
import { ACTION_STATUSES } from "../../models/competitorAnalyzer";

const objectId = z.string().regex(/^[a-f0-9]{24}$/i, "Invalid id");
const url = z.string().trim().min(3).max(300);
const text = (max: number) => z.string().trim().max(max);
const place = z.string().trim().min(2).max(80);

const studyBody = z.object({
  name: z.string().trim().min(2).max(140),
  ownUrl: url.optional(),
  competitors: z.array(z.union([url, z.object({ url, name: text(120).optional() })])).max(4).default([]),
  serviceFocus: z.array(z.string().trim().min(2).max(60)).max(12).default([]),
  geography: z.object({ scope: z.enum(["city", "region", "state", "country", "international"]).default("region"), places: z.array(place).max(20).default([]), country: text(60).default("India") }).default({ scope: "region", places: [], country: "India" }),
  goal: text(500).default(""),
  maxPagesPerSite: z.coerce.number().int().min(1).max(50).default(10),
  settings: z.object({ schedule: z.enum(["off", "weekly", "monthly"]).optional(), alerts: z.boolean().optional(), pagespeed: z.boolean().optional(), ai: z.boolean().optional(), alertEmails: z.array(z.string().trim().email().max(200)).max(5).optional(), monthlyReport: z.boolean().optional() }).partial().default({}),
});

export const createStudySchema = z.object({ body: studyBody });
export const updateStudySchema = z.object({ params: z.object({ id: objectId }), body: studyBody.partial().extend({ expectedRevision: z.coerce.number().int().min(1) }) });
export const idParam = z.object({ params: z.object({ id: objectId }) });
export const runParams = z.object({ params: z.object({ id: objectId, runId: objectId }) });
export const startRunSchema = z.object({ params: z.object({ id: objectId }), body: z.object({ idempotencyKey: z.string().trim().min(8).max(100).optional() }).default({}) });
export const listStudiesSchema = z.object({ query: z.object({ status: z.enum(["active", "archived", "all"]).optional(), page: z.coerce.number().int().min(1).max(1000).optional(), limit: z.coerce.number().int().min(1).max(100).optional(), q: text(100).optional() }) });
export const listRunsSchema = z.object({ params: z.object({ id: objectId }), query: z.object({ page: z.coerce.number().int().min(1).max(1000).optional(), limit: z.coerce.number().int().min(1).max(50).optional() }) });
export const snapshotParams = z.object({ params: z.object({ id: objectId, runId: objectId, domain: z.string().trim().min(3).max(253).regex(/^[a-z0-9.-]+$/i) }) });
export const compareRunsSchema = z.object({ params: z.object({ id: objectId }), query: z.object({ from: objectId, to: objectId }) });

export const discoverySchema = z.object({
  body: z.object({
    keywords: z.array(z.string().trim().min(3).max(120)).min(1).max(8),
    location: z.string().trim().min(2).max(120),
    serviceCategory: text(80).optional(),
    language: z.enum(["en", "hi", "hinglish", "any"]).default("any"),
    intent: text(200).optional(),
  }),
});
export const autoDiscoverSchema = z.object({ body: z.object({ url: url.optional(), location: text(120).optional(), max: z.coerce.number().int().min(1).max(4).optional() }).default({}) });
export const addCandidateSchema = z.object({ body: z.object({ url, businessName: text(160).optional(), notes: text(2000).optional(), watchlisted: z.boolean().optional() }) });
export const updateCandidateSchema = z.object({
  params: z.object({ id: objectId }),
  body: z.object({ status: z.enum(["candidate", "approved", "rejected"]).optional(), classification: z.enum(["direct", "indirect", "service_specialist", "aggregator", "publisher", "unrelated", "needs_review"]).optional(), watchlisted: z.boolean().optional(), notes: text(2000).optional(), businessName: text(160).optional() }),
});
export const listCandidatesSchema = z.object({ query: z.object({ status: z.enum(["candidate", "approved", "rejected"]).optional(), watchlisted: z.enum(["true", "false"]).optional(), classification: text(40).optional() }) });

export const keywordGenerateSchema = z.object({ body: z.object({ seeds: z.array(z.string().trim().min(3).max(120)).max(30).default([]), location: text(120).default("Delhi NCR"), useAi: z.boolean().default(false) }) });
export const listKeywordsSchema = z.object({ query: z.object({ intent: text(30).optional(), cluster: text(60).optional(), language: z.enum(["en", "hi", "hinglish"]).optional() }) });

export const updateActionSchema = z.object({
  params: z.object({ id: objectId, actionId: objectId }),
  body: z.object({ status: z.enum(ACTION_STATUSES).optional(), assignee: text(120).nullable().optional(), dueDate: z.string().datetime({ offset: true }).or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).nullable().optional(), notes: text(4000).optional(), priority: z.enum(["high", "medium", "low"]).optional() }),
});
export const listActionsSchema = z.object({ params: z.object({ id: objectId }), query: z.object({ status: z.enum(ACTION_STATUSES).optional() }) });

export const pdfSchema = z.object({ params: z.object({ id: objectId, runId: objectId }), query: z.object({ lang: z.enum(["en", "hi"]).default("en") }) });
export const screenshotSchema = z.object({ params: z.object({ id: objectId, runId: objectId, domain: z.string().trim().min(3).max(253).regex(/^[a-z0-9.-]+$/i) }) });
export const createShareSchema = z.object({ params: z.object({ id: objectId }), body: z.object({ runId: objectId.optional(), days: z.union([z.literal(7), z.literal(30), z.literal(90)]).default(30) }) });
export const shareParams = z.object({ params: z.object({ id: objectId, shareId: objectId }) });
