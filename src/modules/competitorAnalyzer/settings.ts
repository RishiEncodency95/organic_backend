import { z } from "zod";
import { CompetitorAnalyzerConfig, CompetitorConfigVersion, CompetitorFeedback } from "../../models/competitorAnalyzer/config.model";
import { SITE_SCOPE } from "../../models/competitorAnalyzer";
import { COMPARISON_BUSINESS_CONTEXT, DISCOVERY_BUSINESS_CONTEXT, KEYWORD_BUSINESS_CONTEXT } from "./ai/prompts";
import { AnalyzerError } from "./errors";
import { MOKSHA_CONFIG, setActiveBusinessConfig, type BusinessConfig, type PageKind } from "./taxonomy";

/*
 * Admin-trainable analyzer settings (DECISIONS.md D-010). What admins can change WITHOUT a code deploy:
 *   business profile, service categories + matching patterns, page-kind patterns/priorities, place names,
 *   keyword seeds, category weights, per-check enable/weight/severity, the business-context part of every
 *   AI prompt, standing guidance rules, and whether learned feedback is used.
 * What admins can NOT change (safety, enforced in code): the non-editable prompt safety rules, citation/quote
 * validation, unknown-is-not-zero scoring, SSRF protection, robots enforcement, budget controls.
 * Every save is versioned; runs snapshot the version they used, so old reports never change meaning.
 */

const CATEGORIES = ["clarity", "contact", "trust", "services", "content", "technical", "performance"] as const;
const PAGE_KINDS = ["about", "services", "pricing", "contact", "locations", "faq", "testimonials", "policy", "blog", "service_detail"] as const;

/** Rejects invalid / oversized / obviously catastrophic (nested-quantifier) regex sources. */
const safeRegex = z
  .string()
  .trim()
  .min(2)
  .max(200)
  .refine((s) => {
    try {
      new RegExp(s, "i");
      return true;
    } catch {
      return false;
    }
  }, "Invalid regular expression")
  .refine((s) => !/\([^)]*[+*][^)]*\)\s*[+*{]/.test(s), "Nested quantifiers are not allowed (risk of very slow matching)");

export const settingsSchema = z.object({
  business: z.object({ name: z.string().trim().min(2).max(120), description: z.string().trim().max(1500), brandTerms: z.array(z.string().trim().min(2).max(60)).max(20) }),
  serviceCategories: z.array(z.object({ id: z.string().trim().regex(/^[a-z0-9_]{2,40}$/), label: z.string().trim().min(2).max(80), enabled: z.boolean().default(true), patterns: z.array(safeRegex).min(1).max(15) })).min(1).max(40),
  pageKinds: z.array(z.object({ kind: z.enum(PAGE_KINDS), priority: z.number().int().min(1).max(99), patterns: z.array(safeRegex).min(1).max(15) })).min(1).max(20),
  places: z.array(z.string().trim().min(2).max(60)).max(300),
  keywordSeeds: z.array(z.string().trim().min(3).max(120)).max(100),
  categoryWeights: z.object(Object.fromEntries(CATEGORIES.map((c) => [c, z.number().min(0).max(100)])) as Record<(typeof CATEGORIES)[number], z.ZodNumber>),
  checkOverrides: z.record(z.string().regex(/^[A-Z]{3}-\d{3}$/), z.object({ enabled: z.boolean().optional(), weight: z.number().min(0).max(10).optional(), severity: z.enum(["critical", "high", "medium", "low"]).optional() })).default({}),
  prompts: z.object({
    comparisonContext: z.string().trim().min(20).max(6000),
    discoveryContext: z.string().trim().min(20).max(4000),
    keywordContext: z.string().trim().min(20).max(3000),
  }),
  guidance: z.array(z.string().trim().min(5).max(400)).max(40),
  learning: z.object({ useFeedback: z.boolean(), maxLessons: z.number().int().min(0).max(50) }),
});
export type AnalyzerSettings = z.infer<typeof settingsSchema>;

export const DEFAULT_SETTINGS: AnalyzerSettings = {
  business: { name: MOKSHA_CONFIG.name, description: "Funeral, cremation, ritual, body transport, asthi visarjan, repatriation and pre-planning support in India.", brandTerms: ["moksha voyage", "mokshavoyage"] },
  serviceCategories: MOKSHA_CONFIG.serviceCategories.map((c) => ({ id: c.id, label: c.label, enabled: true, patterns: c.patterns.map((p) => p.source) })),
  pageKinds: MOKSHA_CONFIG.pageKinds.map((k) => ({ kind: k.kind as (typeof PAGE_KINDS)[number], priority: k.priority, patterns: k.patterns.map((p) => p.source) })),
  places: MOKSHA_CONFIG.places,
  keywordSeeds: MOKSHA_CONFIG.keywordSeeds,
  categoryWeights: { clarity: 20, contact: 20, trust: 20, services: 15, content: 10, technical: 10, performance: 5 },
  checkOverrides: {},
  prompts: { comparisonContext: COMPARISON_BUSINESS_CONTEXT, discoveryContext: DISCOVERY_BUSINESS_CONTEXT, keywordContext: KEYWORD_BUSINESS_CONTEXT },
  guidance: [],
  learning: { useFeedback: true, maxLessons: 20 },
};

export function compileBusinessConfig(s: AnalyzerSettings): BusinessConfig {
  return {
    id: SITE_SCOPE,
    name: s.business.name,
    serviceCategories: s.serviceCategories.filter((c) => c.enabled).map((c) => ({ id: c.id, label: c.label, patterns: c.patterns.map((p) => new RegExp(p, "i")) })),
    pageKinds: s.pageKinds.map((k) => ({ kind: k.kind as PageKind, priority: k.priority, patterns: k.patterns.map((p) => new RegExp(p, "i")) })),
    places: s.places,
    keywordSeeds: s.keywordSeeds,
  };
}

export interface ActiveSettings {
  version: number;
  source: "db" | "defaults";
  settings: AnalyzerSettings;
  /** Bounded lessons from admin feedback, already formatted for prompts */
  lessons: { comparison: string[]; discovery: string[] };
}

let cache: { at: number; value: ActiveSettings } | null = null;
const CACHE_MS = 30_000;
export const clearSettingsCache = () => {
  cache = null;
};

export async function loadActiveSettings(opts: { fresh?: boolean } = {}): Promise<ActiveSettings> {
  if (!opts.fresh && cache && Date.now() - cache.at < CACHE_MS) return cache.value;
  const doc = await CompetitorAnalyzerConfig.findOne({ siteScope: SITE_SCOPE }).lean<any>();
  let settings = DEFAULT_SETTINGS;
  let source: ActiveSettings["source"] = "defaults";
  if (doc) {
    const parsed = settingsSchema.safeParse(doc.settings);
    // A stored document that no longer validates (e.g. after a schema change) falls back to defaults, loudly.
    if (parsed.success) {
      settings = parsed.data;
      source = "db";
    }
  }
  const lessons = { comparison: [] as string[], discovery: [] as string[] };
  if (settings.learning.useFeedback && settings.learning.maxLessons > 0) {
    const fb = await CompetitorFeedback.find({ siteScope: SITE_SCOPE, active: true }).sort({ createdAt: -1 }).limit(settings.learning.maxLessons * 2).lean<any[]>();
    for (const f of fb) {
      if (f.kind.startsWith("action") || f.kind === "guidance") lessons.comparison.push(f.lesson);
      if (f.kind.startsWith("candidate") || f.kind === "guidance") lessons.discovery.push(f.lesson);
    }
    lessons.comparison = lessons.comparison.slice(0, settings.learning.maxLessons);
    lessons.discovery = lessons.discovery.slice(0, settings.learning.maxLessons);
  }
  const value: ActiveSettings = { version: doc?.version ?? 0, source, settings, lessons };
  setActiveBusinessConfig(compileBusinessConfig(settings));
  cache = { at: Date.now(), value };
  return value;
}

export async function saveSettings(input: unknown, expectedVersion: number, by: string | null, note = "") {
  const parsed = settingsSchema.safeParse(input);
  if (!parsed.success) throw new AnalyzerError(400, "INVALID_URL", `Invalid settings: ${parsed.error.issues.slice(0, 5).map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}`);
  const ids = parsed.data.serviceCategories.map((c) => c.id);
  if (new Set(ids).size !== ids.length) throw new AnalyzerError(400, "INVALID_URL", "Service category ids must be unique");
  const settings = parsed.data;
  let doc: any;
  if (expectedVersion === 0) {
    try {
      doc = (await CompetitorAnalyzerConfig.create({ siteScope: SITE_SCOPE, version: 1, settings, updatedBy: by, note })).toObject();
    } catch (e: any) {
      if (e?.code === 11000) throw new AnalyzerError(409, "REVISION_CONFLICT", "Settings were saved by someone else; reload");
      throw e;
    }
  } else {
    doc = await CompetitorAnalyzerConfig.findOneAndUpdate({ siteScope: SITE_SCOPE, version: expectedVersion }, { $set: { settings, updatedBy: by, note }, $inc: { version: 1 } }, { returnDocument: "after" }).lean();
    if (!doc) throw new AnalyzerError(409, "REVISION_CONFLICT", "Settings were saved by someone else; reload");
  }
  await CompetitorConfigVersion.create({ siteScope: SITE_SCOPE, version: doc.version, settings, savedBy: by, note });
  clearSettingsCache();
  return loadActiveSettings({ fresh: true });
}

export async function listSettingsVersions() {
  return CompetitorConfigVersion.find({ siteScope: SITE_SCOPE }).select("version savedBy note createdAt").sort({ version: -1 }).limit(100).lean();
}

export async function rollbackSettings(version: number, expectedVersion: number, by: string | null) {
  const old = await CompetitorConfigVersion.findOne({ siteScope: SITE_SCOPE, version }).lean<any>();
  if (!old) throw new AnalyzerError(404, "STUDY_NOT_FOUND", `Settings version ${version} not found`);
  return saveSettings(old.settings, expectedVersion, by, `Rollback to version ${version}`);
}

// ── Feedback / learning ─────────────────────────────────────────────────────────
export async function recordFeedback(kind: "action_rejected" | "action_approved" | "candidate_reclassified" | "candidate_rejected" | "guidance", lesson: string, opts: { subject?: string; reason?: string; refId?: string; by?: string | null } = {}) {
  const doc = { siteScope: SITE_SCOPE, kind, lesson: lesson.slice(0, 400), subject: opts.subject?.slice(0, 300) ?? null, reason: opts.reason?.slice(0, 500) ?? "", refId: opts.refId ?? null, active: true, by: opts.by ?? null };
  if (opts.refId) await CompetitorFeedback.updateOne({ siteScope: SITE_SCOPE, kind, refId: opts.refId }, { $set: doc }, { upsert: true });
  else await CompetitorFeedback.create(doc);
  clearSettingsCache();
}

export async function listFeedback() {
  return CompetitorFeedback.find({ siteScope: SITE_SCOPE }).sort({ createdAt: -1 }).limit(300).lean();
}

export async function setFeedbackActive(id: string, active: boolean) {
  const res = await CompetitorFeedback.findOneAndUpdate({ _id: id, siteScope: SITE_SCOPE }, { $set: { active } }, { returnDocument: "after" }).lean();
  if (!res) throw new AnalyzerError(404, "STUDY_NOT_FOUND", "Feedback not found");
  clearSettingsCache();
  return res;
}
