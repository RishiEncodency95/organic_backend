import crypto from "node:crypto";
import { Types } from "mongoose";
import { CompetitorRun, CompetitorShare, CompetitorSnapshot, CompetitorStudy, SITE_SCOPE } from "../../../models/competitorAnalyzer";
import { AnalyzerError } from "../errors";
import { withMeasuredComparison } from "./headToHead";

/*
 * Share links (read-only, no login). Fixes the reference implementation's leak: the public response is built from
 * an explicit ALLOW-LIST of fields, never by deleting fields from the internal document, so nested private data
 * (own Search Console, settings, usage, lease, studyConfig, actions notes, crawl internals) can never leak.
 * Token: 32 random bytes, only its SHA-256 is stored; every request re-checks expiry, revocation and archive state.
 * A share is bound to ONE fixed run, so the shared report never changes after it is sent.
 */

const hash = (t: string) => crypto.createHash("sha256").update(t).digest("hex");
const adminBase = () => (process.env.ADMIN_URL || "http://localhost:3003").replace(/\/+$/, "");

export async function createShare(studyId: string, body: { runId?: string; days: 7 | 30 | 90 }, by: string | null) {
  const study = await CompetitorStudy.findOne({ _id: studyId, siteScope: SITE_SCOPE }).lean<any>();
  if (!study) throw new AnalyzerError(404, "STUDY_NOT_FOUND", "Study not found");
  const runId = body.runId ?? (study.latestSuccessfulRunId ? String(study.latestSuccessfulRunId) : null);
  if (!runId || !Types.ObjectId.isValid(runId)) throw new AnalyzerError(409, "RUN_NOT_FOUND", "There is no completed report to share yet");
  const run = await CompetitorRun.findOne({ _id: runId, studyId, status: "completed" }).select("_id").lean();
  if (!run) throw new AnalyzerError(409, "RUN_NOT_FOUND", "Only completed reports can be shared");
  const token = crypto.randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + body.days * 86_400_000);
  const share = await CompetitorShare.create({ siteScope: SITE_SCOPE, tokenHash: hash(token), studyId, runId, expiresAt, createdBy: by });
  // The token is returned ONCE; afterwards only metadata is listed.
  return { id: String(share._id), url: `${adminBase()}/shared/competitor-report/${token}`, expiresAt, runId };
}

export async function listShares(studyId: string) {
  const rows = await CompetitorShare.find({ studyId, siteScope: SITE_SCOPE }).sort({ createdAt: -1 }).limit(50).lean<any[]>();
  const now = Date.now();
  return rows.map((s) => ({ id: String(s._id), runId: String(s.runId), createdAt: s.createdAt, expiresAt: s.expiresAt, revokedAt: s.revokedAt, views: s.views, lastViewedAt: s.lastViewedAt, active: !s.revokedAt && new Date(s.expiresAt).getTime() > now }));
}

export async function revokeShare(studyId: string, shareId: string) {
  const r = await CompetitorShare.findOneAndUpdate({ _id: shareId, studyId, siteScope: SITE_SCOPE, revokedAt: null }, { $set: { revokedAt: new Date() } }, { returnDocument: "after" }).lean();
  if (!r) throw new AnalyzerError(404, "RUN_NOT_FOUND", "Share link not found or already revoked");
  return { revoked: true };
}

/** Resolves a public token; throws 404 for unknown/expired/revoked/archived (no detail leaked). */
export async function resolveShare(token: string, countView = true) {
  if (!/^[A-Za-z0-9_-]{40,60}$/.test(token)) throw new AnalyzerError(404, "RUN_NOT_FOUND", "This link is not valid");
  const share = await CompetitorShare.findOne({ tokenHash: hash(token) }).lean<any>();
  if (!share || share.revokedAt || new Date(share.expiresAt).getTime() <= Date.now()) throw new AnalyzerError(404, "RUN_NOT_FOUND", "This link has expired or was revoked");
  const study = await CompetitorStudy.findById(share.studyId).select("name status").lean<any>();
  if (!study || study.status === "archived") throw new AnalyzerError(404, "RUN_NOT_FOUND", "This report is no longer available");
  const run = await CompetitorRun.findOne({ _id: share.runId, status: "completed" }).lean<any>();
  if (!run?.report) throw new AnalyzerError(404, "RUN_NOT_FOUND", "This report is no longer available");
  if (countView) await CompetitorShare.updateOne({ _id: share._id }, { $inc: { views: 1 }, $set: { lastViewedAt: new Date() } });
  return { share, study, run };
}

const pick = <T extends Record<string, any>>(o: T | null | undefined, keys: (keyof T)[]) => (o ? Object.fromEntries(keys.filter((k) => o[k] !== undefined).map((k) => [k, o[k]])) : null);
const cites = (list: any[] | undefined) => (list ?? []).slice(0, 5).map((c) => ({ url: String(c.url ?? ""), quote: String(c.quote ?? "") }));
const claims = (list: any[] | undefined) => (list ?? []).map((c) => ({ text: String(c.text ?? ""), evidence: cites(c.evidence) }));

/** Allow-list public projection of a saved run. Anything not listed here is never sent. */
export function publicReportDto(study: { name: string }, run: any, actions: any[] = []) {
  const r = withMeasuredComparison(run.report ?? {});
  // Legacy narratives may contain private GSC information; only narratives generated from public inputs are shared.
  const ai = r.ai?.publicSafe === true ? r.ai.result ?? null : null;
  return {
    studyName: r.studyName ?? run.studyConfig?.name ?? "Competitor report",
    runId: String(run._id),
    finishedAt: run.finishedAt,
    report: {
      measuredHeadToHead: r.measuredHeadToHead,
      pageComparisons: (r.pageComparisons ?? []).map((p: any) => ({ competitor: p.competitor, service: p.service, place: p.place, status: p.status, ownPage: pick(p.ownPage, ["url", "title"]), competitorPage: pick(p.competitorPage, ["url", "title"]) })),
      generatedAt: r.generatedAt,
      scope: { own: r.scope?.own, competitors: r.scope?.competitors ?? [], serviceFocus: r.scope?.serviceFocus ?? [], places: r.scope?.geography?.places ?? [] },
      sites: (r.sites ?? []).map((s: any) => ({
        domain: s.domain,
        role: s.role,
        siteName: s.siteName,
        rootUrl: s.rootUrl,
        crawlState: s.crawlState,
        coverage: pick(s.coverage, ["read", "selected", "failed", "status", "missingPriorityKinds"]),
        sitemap: pick(s.sitemap, ["found", "entryCount", "latestLastmod", "recent30", "recent90"]),
        newestContentDate: s.newestContentDate ?? null,
        upClose: s.upClose ?? null,
        brand: s.brand ? pick(s.brand, ["state", "name", "types"]) : null,
        hasScreenshot: !!s.hasScreenshot,
        socials: (s.socials ?? []).map((x: any) => ({ platform: x.platform, href: x.href })),
        score: s.score ? { overall: s.score.overall, scoredWeight: s.score.scoredWeight, rubricVersion: s.score.rubricVersion, evidenceCoverage: s.score.evidenceCoverage, calibration: s.score.calibration ? pick(s.score.calibration, ["status", "benchmark", "note"]) : null, categories: (s.score.categories ?? []).map((c: any) => pick(c, ["category", "label", "weight", "score", "coverage", "evaluated", "unknown"])) } : null,
        speed: s.speed ? { state: s.speed.state, mobile: s.speed.mobile, field: s.speed.field } : null,
        services: (s.services ?? []).map((x: any) => ({ category: x.category, label: x.label, state: x.state, evidence: (x.evidence ?? []).slice(0, 2).map((e: any) => ({ url: e.url, excerpt: e.excerpt })) })),
        prices: (s.prices ?? []).slice(0, 20).map((p: any) => pick(p, ["raw", "amount", "currency", "startingFrom", "tax", "unit", "excerpt", "sourceUrl"])),
        features: Object.fromEntries(Object.entries(s.features ?? {}).map(([k, v]: [string, any]) => [k, { state: v.state, evidence: (v.evidence ?? []).slice(0, 1).map((e: any) => ({ url: e.url, excerpt: e.excerpt })) }])),
        places: (s.places ?? []).map((p: any) => ({ place: p.place })),
      })),
      leaders: (r.leaders ?? []).map((l: any) => pick(l, ["category", "label", "scores", "leader", "tie"])),
      scopes: (r.scopes ?? []).map((x: any) => pick(x, ["competitor", "sharedServices", "ownOnly", "competitorOnly", "overlap", "comparable", "note"])),
      overallComparable: !!r.overallComparable,
      ai: {
        grounding: r.ai?.grounding ?? null,
        status: r.ai?.result && !ai ? "private_legacy_analysis" : r.ai?.status ?? null,
        result: ai
          ? {
              summary: ai.summary ?? null,
              headToHead: (ai.headToHead ?? []).map((h: any) => ({ competitor: h.competitor, ownLeads: claims(h.ownLeads), competitorLeads: claims(h.competitorLeads), verdict: String(h.verdict ?? "") })),
              gaps: (ai.gaps ?? []).map((g: any) => ({ title: g.title, detail: g.detail, category: g.category, evidence: cites(g.evidence) })),
              recommendations: (ai.recommendations ?? []).map((x: any) => ({ title: x.title, problem: x.problem, recommendation: x.recommendation, priority: x.priority, effort: x.effort, horizonDays: x.horizonDays, category: x.category, evidence: cites(x.evidence) })),
              contentIdeas: (ai.contentIdeas ?? []).map((x: any) => ({ title: x.title, format: x.format, reason: x.reason, outline: x.outline ?? [] })),
            }
          : null,
      },
      changes: (r.changes ?? null) && r.changes.map((c: any) => ({ domain: c.domain, comparable: !!c.diff?.comparable, changes: (c.diff?.changes ?? []).slice(0, 30).map((x: any) => pick(x, ["kind", "subject", "url"])) })),
      quality: r.quality ? { status: r.quality.status, completeness: r.quality.completeness, rule: "Coverage describes the saved sample, not a probability of correctness. Review missing page types for each website.", issues: [] } : null,
      methodology: r.methodology ? { rubricVersion: r.methodology.rubricVersion, checkCount: r.methodology.checkCount, rules: r.methodology.rules ?? [] } : null,
      limitations: r.limitations ?? [],
    },
    actions: (r.actions ?? []).filter((a: any) => a.status !== "rejected" && (ai || a.source !== "ai")).slice(0, 30).map((a: any) => ({ title: a.title, priority: a.priority, status: a.status, recommendation: a.recommendation })),
  };
}

export async function publicReport(token: string) {
  const { study, run } = await resolveShare(token);
  return publicReportDto(study, run);
}

export async function screenshotFor(runId: unknown, domain: string) {
  const snap = await CompetitorSnapshot.findOne({ runId, domain: domain.toLowerCase() }).select("speed.screenshot").lean<any>();
  const shot = snap?.speed?.screenshot;
  if (typeof shot !== "string" || !shot.startsWith("data:image/jpeg;base64,")) throw new AnalyzerError(404, "RUN_NOT_FOUND", "No screenshot");
  return Buffer.from(shot.slice("data:image/jpeg;base64,".length), "base64");
}
