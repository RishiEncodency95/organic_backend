import mongoose, { Schema, Types } from "mongoose";

/*
 * Competitor Analyzer models (DATA_MODELS.md). Invariants enforced by indexes:
 *  - one active run per study            → CompetitorRun.activeKey unique (partial: only while queued/running)
 *  - idempotent run requests             → CompetitorRun {studyId, idempotencyKey} unique (partial)
 *  - one candidate per domain per scope  → CompetitorCandidate {siteScope, domain} unique
 *  - no duplicate actions per study      → CompetitorAction {studyId, actionKey} unique
 *  - one keyword per normalised form     → CompetitorKeyword {siteScope, normalized} unique
 *  - atomic daily AI budget              → CompetitorBudgetDay {day} unique, conditional $inc
 * `siteScope` is the tenant/site key (currently always "moksha-voyage"), resolved server-side, never from the client.
 */

const Mixed = Schema.Types.Mixed;

// ── Study ──────────────────────────────────────────────────────────────────────
const competitorSiteSchema = new Schema({ url: { type: String, required: true }, domain: { type: String, required: true }, name: { type: String, default: null }, addedAt: { type: Date, default: Date.now } }, { _id: false });

const studySchema = new Schema(
  {
    siteScope: { type: String, required: true, index: true },
    name: { type: String, required: true, trim: true, maxlength: 140 },
    ownUrl: { type: String, required: true },
    ownDomain: { type: String, required: true },
    competitors: { type: [competitorSiteSchema], default: [] },
    serviceFocus: { type: [String], default: [] },
    geography: { scope: { type: String, enum: ["city", "region", "state", "country", "international"], default: "region" }, places: { type: [String], default: [] }, country: { type: String, default: "India" } },
    goal: { type: String, default: "", maxlength: 500 },
    maxPagesPerSite: { type: Number, default: 10, min: 1, max: 50 },
    settings: {
      schedule: { type: String, enum: ["off", "weekly", "monthly"], default: "off" },
      alerts: { type: Boolean, default: false },
      pagespeed: { type: Boolean, default: true },
      ai: { type: Boolean, default: true },
      alertEmails: { type: [String], default: [] },
      monthlyReport: { type: Boolean, default: false },
    },
    revision: { type: Number, default: 1 },
    status: { type: String, enum: ["active", "archived"], default: "active", index: true },
    archivedAt: { type: Date, default: null },
    latestRunId: { type: Types.ObjectId, default: null },
    latestSuccessfulRunId: { type: Types.ObjectId, default: null },
    lastRunAt: { type: Date, default: null },
    nextScheduledAt: { type: Date, default: null, index: true },
    lastScheduledAt: { type: Date, default: null },
    nextReportAt: { type: Date, default: null, index: true },
    scheduleLease: { type: Mixed, default: null },
    reportDelivery: { type: Mixed, default: null },
    createdBy: { type: String, default: null },
    updatedBy: { type: String, default: null },
  },
  { timestamps: true },
);
studySchema.index({ siteScope: 1, status: 1, updatedAt: -1 });

// ── Run ────────────────────────────────────────────────────────────────────────
export const RUN_STATUSES = ["queued", "running", "completed", "failed", "cancelled", "reconciliation_required"] as const;
export const ACTIVE_RUN_STATUSES = ["queued", "running"] as const;
export type RunStatus = (typeof RUN_STATUSES)[number];

const runSchema = new Schema(
  {
    siteScope: { type: String, required: true },
    studyId: { type: Types.ObjectId, required: true, index: true },
    /** = studyId while queued/running, removed on terminal state → unique index gives one active run per study */
    activeKey: { type: String },
    idempotencyKey: { type: String },
    trigger: { type: String, enum: ["manual", "scheduled"], default: "manual" },
    studyConfig: { type: Mixed, required: true },
    configRevision: { type: Number, required: true },
    status: { type: String, enum: RUN_STATUSES, default: "queued", index: true },
    stage: { type: String, default: "waiting" },
    progress: { done: { type: Number, default: 0 }, total: { type: Number, default: 0 }, message: { type: String, default: "" } },
    cancelRequestedAt: { type: Date, default: null },
    lease: { owner: { type: String, default: null }, token: { type: String, default: null }, expiresAt: { type: Date, default: null } },
    heartbeatAt: { type: Date, default: null },
    attempts: { type: Number, default: 0 },
    paidStartedAt: { type: Date, default: null },
    paidFinishedAt: { type: Date, default: null },
    actionsProjectedAt: { type: Date, default: null },
    startedAt: { type: Date, default: null },
    finishedAt: { type: Date, default: null },
    error: { code: { type: String, default: null }, message: { type: String, default: null } },
    quality: { type: Mixed, default: null },
    ai: { type: Mixed, default: null },
    report: { type: Mixed, default: null },
    versions: { type: Mixed, default: null },
    /** Admin settings version + content used by this run (immutable) */
    settingsSnapshot: { type: Mixed, default: null },
    /** Change-alert delivery for scheduled runs (sent at most once) */
    alert: { type: Mixed },
    /** Cached report translations, e.g. translations.hi = { promptVersion, map } */
    translations: { type: Mixed, default: null },
    translationJob: { type: Mixed, default: null },
    createdBy: { type: String, default: null },
  },
  { timestamps: true },
);
runSchema.index({ activeKey: 1 }, { unique: true, partialFilterExpression: { activeKey: { $type: "string" } } });
runSchema.index({ studyId: 1, idempotencyKey: 1 }, { unique: true, partialFilterExpression: { idempotencyKey: { $type: "string" } } });
runSchema.index({ studyId: 1, createdAt: -1 });
runSchema.index({ status: 1, "lease.expiresAt": 1 });

// ── Per-site immutable snapshot of one run ────────────────────────────────────
const snapshotSchema = new Schema(
  {
    siteScope: { type: String, required: true },
    runId: { type: Types.ObjectId, required: true, index: true },
    studyId: { type: Types.ObjectId, required: true },
    domain: { type: String, required: true },
    role: { type: String, enum: ["own", "competitor"], required: true },
    crawl: { type: Mixed, required: true },
    evidence: { type: Mixed, required: true },
    checks: { type: Mixed, required: true },
    score: { type: Mixed, default: null },
    speed: { type: Mixed, default: null },
    brand: { type: Mixed, default: null },
  },
  { timestamps: true },
);
snapshotSchema.index({ runId: 1, domain: 1 }, { unique: true });
snapshotSchema.index({ studyId: 1, domain: 1, createdAt: -1 });

// ── Discovery candidates / watchlist ──────────────────────────────────────────
const candidateSchema = new Schema(
  {
    siteScope: { type: String, required: true },
    domain: { type: String, required: true },
    url: { type: String, required: true },
    businessName: { type: String, default: null },
    discoveries: {
      type: [
        new Schema({ keyword: String, location: String, source: { type: String, enum: ["openai_web_search", "manual", "page_link"] }, citations: [String], citationsVerified: Boolean, discoveredAt: Date, by: String }, { _id: false }),
      ],
      default: [],
    },
    verification: {
      state: { type: String, enum: ["pending", "verified", "no_service_match", "unreachable", "blocked", "redirected", "robots_disallowed"], default: "pending" },
      checkedAt: { type: Date, default: null },
      siteName: { type: String, default: null },
      finalUrl: { type: String, default: null },
      servicesMatched: { type: [String], default: [] },
      issues: { type: [String], default: [] },
    },
    classification: { type: String, enum: ["direct", "indirect", "service_specialist", "aggregator", "publisher", "unrelated", "needs_review"], default: "needs_review" },
    relevance: { type: String, default: "" },
    claimedGeography: { type: [String], default: [] },
    matchingServices: { type: [String], default: [] },
    status: { type: String, enum: ["candidate", "approved", "rejected"], default: "candidate" },
    watchlisted: { type: Boolean, default: false },
    notes: { type: String, default: "", maxlength: 2000 },
  },
  { timestamps: true },
);
candidateSchema.index({ siteScope: 1, domain: 1 }, { unique: true });

// ── Actions ───────────────────────────────────────────────────────────────────
export const ACTION_STATUSES = ["suggested", "needs_review", "approved", "todo", "doing", "implemented", "verified", "rejected"] as const;
const actionSchema = new Schema(
  {
    siteScope: { type: String, required: true },
    studyId: { type: Types.ObjectId, required: true, index: true },
    originRunId: { type: Types.ObjectId, required: true },
    lastSeenRunId: { type: Types.ObjectId, required: true },
    actionKey: { type: String, required: true },
    source: { type: String, enum: ["check", "ai"], required: true },
    checkId: { type: String, default: null },
    category: { type: String, default: null },
    title: { type: String, required: true, maxlength: 300 },
    problem: { type: String, default: "" },
    recommendation: { type: String, default: "" },
    evidence: { type: [new Schema({ url: String, quote: String }, { _id: false })], default: [] },
    priority: { type: String, enum: ["high", "medium", "low"], default: "medium" },
    impactRationale: { type: String, default: "" },
    effort: { type: String, enum: ["S", "M", "L"], default: "M" },
    horizonDays: { type: Number, default: null },
    status: { type: String, enum: ACTION_STATUSES, default: "suggested" },
    assignee: { type: String, default: null },
    dueDate: { type: Date, default: null },
    notes: { type: String, default: "", maxlength: 4000 },
    verificationCriteria: { type: String, default: "" },
    /** Set when a later run's evidence shows the check passing (implementation verified, NOT business impact). */
    verifiedByRunId: { type: Types.ObjectId, default: null },
    history: { type: [new Schema({ at: Date, by: String, field: String, from: Mixed, to: Mixed }, { _id: false })], default: [] },
  },
  { timestamps: true },
);
actionSchema.index({ studyId: 1, actionKey: 1 }, { unique: true });

// ── Keywords (ideas + observations; never invented metrics) ───────────────────
const keywordSchema = new Schema(
  {
    siteScope: { type: String, required: true },
    normalized: { type: String, required: true },
    keyword: { type: String, required: true },
    language: { type: String, enum: ["en", "hi", "hinglish"], default: "en" },
    intent: { type: String, enum: ["informational", "transactional", "navigational", "commercial", "urgent", "local"], default: "informational" },
    cluster: { type: String, default: null },
    serviceCategory: { type: String, default: null },
    city: { type: String, default: null },
    isQuestion: { type: Boolean, default: false },
    sources: { type: [String], default: [] },
    ownPages: { type: [new Schema({ url: String, title: String, match: String }, { _id: false })], default: [] },
    competitorPages: { type: [new Schema({ domain: String, url: String, title: String }, { _id: false })], default: [] },
    suggestedLandingPage: { type: String, default: null },
    metrics: { searchVolume: { type: Mixed, default: "not_available" }, difficulty: { type: Mixed, default: "not_available" }, cpc: { type: Mixed, default: "not_available" }, position: { type: Mixed, default: "not_available" } },
    /** Measured Google Search Console values for OUR property (latest 28-day window); null when not synced */
    gsc: { type: Mixed, default: null },
    /** Bounded history of GSC windows (keyword history where measured observations exist) */
    gscHistory: { type: [Mixed], default: [] },
  },
  { timestamps: true },
);
keywordSchema.index({ siteScope: 1, normalized: 1 }, { unique: true });

// ── AI usage ledger + budget ──────────────────────────────────────────────────
const usageSchema = new Schema(
  {
    siteScope: { type: String, required: true },
    day: { type: String, required: true, index: true },
    task: { type: String, required: true },
    runId: { type: Types.ObjectId, default: null },
    studyId: { type: Types.ObjectId, default: null },
    model: { type: String, default: null },
    promptVersion: { type: String, default: null },
    status: { type: String, enum: ["reserved", "started", "completed", "failed_not_sent", "uncertain", "released"], default: "reserved" },
    reservedUsd: { type: Number, default: 0 },
    inputTokens: { type: Number, default: null },
    outputTokens: { type: Number, default: null },
    estimatedCostUsd: { type: Number, default: null },
    responseId: { type: String, default: null },
    error: { type: String, default: null },
  },
  { timestamps: true },
);
const budgetDaySchema = new Schema({ siteScope: { type: String, required: true }, day: { type: String, required: true }, committedUsd: { type: Number, default: 0 } }, { timestamps: true });
budgetDaySchema.index({ siteScope: 1, day: 1 }, { unique: true });
const workerSchema = new Schema({ _id: String, siteScope: { type: String, required: true }, heartbeatAt: Date, expiresAt: Date }, { versionKey: false });
workerSchema.index({ siteScope: 1, expiresAt: 1 });

// ── Share links (token hash only; bound to one run) ────────────────────────────
const shareSchema = new Schema(
  {
    siteScope: { type: String, required: true },
    tokenHash: { type: String, required: true, unique: true },
    studyId: { type: Types.ObjectId, required: true, index: true },
    runId: { type: Types.ObjectId, required: true },
    expiresAt: { type: Date, required: true },
    revokedAt: { type: Date, default: null },
    views: { type: Number, default: 0 },
    lastViewedAt: { type: Date, default: null },
    createdBy: { type: String, default: null },
  },
  { timestamps: true },
);

const model = <T>(name: string, schema: Schema) => (mongoose.models[name] as mongoose.Model<T>) || mongoose.model<T>(name, schema);

export const CompetitorStudy = model<any>("CompetitorStudy", studySchema);
export const CompetitorRun = model<any>("CompetitorRun", runSchema);
export const CompetitorSnapshot = model<any>("CompetitorSnapshot", snapshotSchema);
export const CompetitorCandidate = model<any>("CompetitorCandidate", candidateSchema);
export const CompetitorAction = model<any>("CompetitorAction", actionSchema);
export const CompetitorKeyword = model<any>("CompetitorKeyword", keywordSchema);
export const CompetitorUsage = model<any>("CompetitorUsage", usageSchema);
export const CompetitorBudgetDay = model<any>("CompetitorBudgetDay", budgetDaySchema);
export const CompetitorShare = model<any>("CompetitorShare", shareSchema);
export const CompetitorWorker = model<any>("CompetitorWorker", workerSchema);

export const SITE_SCOPE = "moksha-voyage";
