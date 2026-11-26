import mongoose, { Schema } from "mongoose";

/*
 * Admin-editable analyzer configuration ("train without code changes").
 *  - CompetitorAnalyzerConfig: ONE live document per siteScope, optimistic `version` (incremented on every save)
 *  - CompetitorConfigVersion: immutable copy of every saved version (audit + rollback)
 *  - CompetitorFeedback: admin decisions the analyzer learns from (rejected recommendations with reasons,
 *    reclassified candidates, explicit guidance). Used to build prompt guidance; never edits evidence.
 * Code defaults (analysis/settings.ts DEFAULT_SETTINGS) are only the fallback when no document exists.
 */

const Mixed = Schema.Types.Mixed;

const configSchema = new Schema(
  {
    siteScope: { type: String, required: true, unique: true },
    version: { type: Number, default: 1 },
    settings: { type: Mixed, required: true },
    updatedBy: { type: String, default: null },
    note: { type: String, default: "" },
  },
  { timestamps: true, minimize: false },
);

const configVersionSchema = new Schema(
  {
    siteScope: { type: String, required: true },
    version: { type: Number, required: true },
    settings: { type: Mixed, required: true },
    savedBy: { type: String, default: null },
    note: { type: String, default: "" },
  },
  { timestamps: true, minimize: false },
);
configVersionSchema.index({ siteScope: 1, version: -1 }, { unique: true });

export const FEEDBACK_KINDS = ["action_rejected", "action_approved", "candidate_reclassified", "candidate_rejected", "guidance"] as const;
const feedbackSchema = new Schema(
  {
    siteScope: { type: String, required: true },
    kind: { type: String, enum: FEEDBACK_KINDS, required: true },
    /** Short normalised text the prompt can use, e.g. "Do not recommend: add client logos — families' privacy" */
    lesson: { type: String, required: true, maxlength: 400 },
    subject: { type: String, default: null, maxlength: 300 },
    reason: { type: String, default: "", maxlength: 500 },
    refId: { type: String, default: null },
    active: { type: Boolean, default: true },
    by: { type: String, default: null },
  },
  { timestamps: true },
);
feedbackSchema.index({ siteScope: 1, active: 1, createdAt: -1 });
feedbackSchema.index({ siteScope: 1, kind: 1, refId: 1 }, { unique: true, partialFilterExpression: { refId: { $type: "string" } } });

/** Google (Search Console) connection for the OWN site. Refresh token encrypted; never returned by the API. */
const googleConnectionSchema = new Schema(
  {
    siteScope: { type: String, required: true, unique: true },
    status: { type: String, enum: ["pending", "connected", "revoked", "error"], default: "pending" },
    pendingNonce: { type: String, default: null },
    pendingBy: { type: String, default: null },
    refreshTokenEnc: { type: String, default: null },
    scope: { type: String, default: null },
    email: { type: String, default: null },
    property: { type: String, default: null },
    connectedBy: { type: String, default: null },
    connectedAt: { type: Date, default: null },
    lastSyncAt: { type: Date, default: null },
    lastSync: { type: Mixed, default: null },
    lastError: { type: String, default: null },
  },
  { timestamps: true },
);

const model = (name: string, schema: Schema) => (mongoose.models[name] as mongoose.Model<any>) || mongoose.model<any>(name, schema);
export const CompetitorAnalyzerConfig = model("CompetitorAnalyzerConfig", configSchema);
export const CompetitorConfigVersion = model("CompetitorConfigVersion", configVersionSchema);
export const CompetitorFeedback = model("CompetitorFeedback", feedbackSchema);
export const CompetitorGoogleConnection = model("CompetitorGoogleConnection", googleConnectionSchema);
