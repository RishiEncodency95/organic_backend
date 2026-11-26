import { z } from "zod";
import type { Request, Response } from "express";

/** A path on this site ("/about"): no scheme, no whitespace or control characters */
const sitePath = z.string().trim().min(1).max(512).regex(/^\/(?!\/)[^\s\u0000-\u001f]*$/, "must be a path starting with /").refine((v) => !v.includes(".."), "must not contain ..");
const safeRoute = z.string().trim().max(512).refine((r) => !r || (!r.includes("..") && !r.includes("\\") && !/[\u0000-\u001f\s]/.test(r)), "must not contain path traversal (..), backslashes, or control characters");
const anyUrlOrPath = z.string().trim().min(1).max(2048).refine((v) => !/[\u0000-\u001f]/.test(v) && !/\s/.test(v), "must not contain whitespace");
const httpUrl = z.string().trim().max(2048).regex(/^https?:\/\//i, "must be an http(s) URL");

const fixOptions = z
  .object({
    metaTitle: z.string().trim().max(120).optional(),
    metaDescription: z.string().trim().max(400).optional(),
    h1Heading: z.string().trim().max(200).optional(),
    /** what the other <h1> tags of the page become (default h2) */
    h1ExtraTag: z.enum(["h2", "h3", "h4", "p", "div"]).optional(),
    canonicalUrl: httpUrl.optional(),
    fromUrl: anyUrlOrPath.optional(),
    toUrl: anyUrlOrPath.optional(),
    statusCode: z.union([z.literal(301), z.literal(302), z.literal(307), z.literal(308)]).optional(),
    imageSrc: z.string().trim().max(2048).optional(),
    altText: z.string().trim().max(300).optional(),
    alt: z.string().trim().max(300).optional(),
    ogImage: httpUrl.optional(),
    /** schema markup (JSON-LD) typed or edited by the admin: one block or several, with or without <script> tags */
    schemaMarkup: z.string().max(40000).optional(),
  })
  .strict();

export const autoFixSchema = z.object({
  pageUrl: z.string().trim().max(2048).optional().default(""),
  route: z.string().trim().max(512).optional().default(""),
  issueType: z.enum(["title", "description", "canonical", "og", "schema", "robots", "h1", "redirect", "image_alt", "all"]).optional().default("all"),
  options: fixOptions.optional().default({}),
  /** true: only show what would change, write nothing */
  dryRun: z.boolean().optional(),
}).refine((v) => v.route || v.pageUrl, { message: "route or pageUrl is required" });

export const autoFixAllSchema = z.object({
  /** how many pages at most (hard cap 100 on the server) */
  maxPages: z.number().int().min(1).max(100).optional(),
  options: z.unknown().optional(),
});

export const rollbackSchema = z.object({
  fixLogId: z.string().regex(/^[a-f0-9]{24}$/i, "must be a valid id"),
  force: z.boolean().optional().default(false),
});

export const redirectSchema = z.object({
  fromUrl: anyUrlOrPath,
  toUrl: anyUrlOrPath,
  statusCode: z.union([z.literal(301), z.literal(302), z.literal(307), z.literal(308)]).optional().default(301),
});

export const contentAnalyzeSchema = z.object({
  url: z.string().trim().max(2048).optional(),
  route: safeRoute.optional(),
});

export const humanizeSchema = z.object({
  text: z.string().min(20).max(20000),
  instructions: z.string().max(500).optional(),
  targetKeyword: z.string().trim().max(120).optional(),
  route: safeRoute.optional(),
  saveToDb: z.boolean().optional().default(false),
});

export const scheduleSchema = z.object({
  frequency: z.enum(["daily", "weekly", "every_x_days", "once", "on_demand"]),
  intervalDays: z.coerce.number().int().min(1).max(365).optional().default(7),
  autoPilotEnabled: z.boolean().optional().default(false),
  webhookUrl: z.union([httpUrl, z.literal("")]).optional().default(""),
  /** Date and time (ISO, e.g. 2026-11-25T09:30:00.000Z) of the first run; for "once" it is the only run */
  runAt: z.union([z.string().datetime({ offset: true }), z.literal("")]).optional(),
});

export const approvalDecisionSchema = z.object({
  proposalId: z.string().regex(/^[a-f0-9]{24}$/i),
  approveIds: z.array(z.string().regex(/^[a-f0-9]{24}$/i)).max(500).optional().default([]),
  rejectIds: z.array(z.string().regex(/^[a-f0-9]{24}$/i)).max(500).optional().default([]),
}).refine((b) => b.approveIds.length + b.rejectIds.length > 0, { message: "Select at least one change." });

export const triggerSchema = z.object({}).passthrough();

export const notFoundReportSchema = z.object({
  path: z.string().trim().min(1).max(512),
  referrer: z.string().trim().max(512).optional().default(""),
});

export const outreachMentionSchema = z.object({ url: httpUrl });

export const idParam = z.object({ id: z.string().regex(/^[a-f0-9]{24}$/i) });

/** Parses `data`; on failure answers 400 with the problems and returns null. */
export function parseOr400<T>(schema: z.ZodType<T>, data: unknown, res: Response): T | null {
  const r = schema.safeParse(data ?? {});
  if (r.success) return r.data;
  res.status(400).json({
    success: false,
    message: "Validation failed",
    errors: r.error.issues.map((i) => `${i.path.join(".") || "body"}: ${i.message}`),
  });
  return null;
}

export const pageParam = (req: Request, name: string, fallback = 1) => {
  const n = Math.floor(Number(req.query[name]));
  return Number.isFinite(n) && n > 0 ? n : fallback;
};

// ---- page text blocks (Humanize) ----
export const contentBlocksQuerySchema = z.object({ route: sitePath });
export const humanizeBlockSchema = z.object({
  route: sitePath,
  blockId: z.string().trim().min(3).max(300),
}).strict();
export const applyBlockSchema = z.object({
  route: sitePath,
  blockId: z.string().trim().min(3).max(300),
  original: z.string().max(20000),
  text: z.string().min(5).max(20000),
  /** true when the admin typed or changed the text himself */
  edited: z.boolean().optional(),
}).strict();
