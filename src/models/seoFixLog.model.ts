import mongoose, { Document, Schema } from "mongoose";

export interface ISeoFixLog extends Document {
  pageUrl: string;
  route: string;
  issueType: string;
  previousValue: any;
  newValue: any;
  fixedBy: string;
  status: "applied" | "failed" | "reverted";
  /** Every database field this fix touched: { before: {...}, after: {...} } (used by rollback) */
  snapshot?: { before: Record<string, unknown>; after: Record<string, unknown> };
  errorReason?: string;
  reverted: boolean;
  revertedAt?: Date;
  revertedBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

const seoFixLogSchema = new Schema<ISeoFixLog>(
  {
    pageUrl: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    route: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    issueType: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    previousValue: {
      type: Schema.Types.Mixed,
      default: null,
    },
    newValue: {
      type: Schema.Types.Mixed,
      default: null,
    },
    fixedBy: {
      type: String,
      default: "AI Auto-Pilot",
    },
    status: {
      type: String,
      enum: ["applied", "failed", "reverted"],
      default: "applied",
      index: true,
    },
    errorReason: {
      type: String,
    },
    snapshot: {
      type: Schema.Types.Mixed,
    },
    reverted: {
      type: Boolean,
      default: false,
      index: true,
    },
    revertedAt: {
      type: Date,
    },
    revertedBy: {
      type: String,
    },
  },
  {
    timestamps: true,
  }
);

seoFixLogSchema.index({ createdAt: -1 });
seoFixLogSchema.index({ route: 1, issueType: 1 });
seoFixLogSchema.index({ issueType: 1, status: 1, reverted: 1, route: 1 });
// failed / never-completed attempts are only noise after a while; applied and reverted logs are the audit trail and are kept
seoFixLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60, partialFilterExpression: { status: { $in: ["failed", "pending"] } } });

export type AuditLogStatus = "SUCCESS" | "FAILED" | "REVERTED";
export type AuditLogFixedBy = "AUTO_PILOT_AI" | "ADMIN";

/**
 * The audit-log shape of the spec, derived from the stored record (stored values stay as they are, so old data
 * and old code keep working): applied -> SUCCESS, failed -> FAILED, reverted -> REVERTED;
 * "AI Auto-Pilot ..." -> AUTO_PILOT_AI, anything else (a signed-in admin) -> ADMIN.
 */
export function toAuditLogView<T extends { status?: string; reverted?: boolean; fixedBy?: string }>(log: T): Omit<T, "status" | "fixedBy"> & {
  status: AuditLogStatus;
  fixedBy: AuditLogFixedBy;
  fixedByUser: string;
  storedStatus: string;
} {
  const status: AuditLogStatus = log.reverted || log.status === "reverted" ? "REVERTED" : log.status === "failed" || log.status === "pending" ? "FAILED" : "SUCCESS";
  const fixedBy: AuditLogFixedBy = /^AI Auto-Pilot/i.test(log.fixedBy || "") ? "AUTO_PILOT_AI" : "ADMIN";
  return { ...log, status, fixedBy, fixedByUser: log.fixedBy || "", storedStatus: log.status || "applied" };
}

const SeoFixLog =
  mongoose.models.SeoFixLog || mongoose.model<ISeoFixLog>("SeoFixLog", seoFixLogSchema);

export default SeoFixLog;
