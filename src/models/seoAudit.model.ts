import mongoose, { Document, Schema } from "mongoose";

export interface ISeoAuditSnapshot extends Document {
  _id: mongoose.Types.ObjectId;
  origin: string;
  reportRoute: string;
  report: unknown;
  crawls: unknown[];
  siteChecks: unknown;
  gsc: unknown;
  llm: unknown;
  pageSpeed: unknown;
  durationMs: number;
  createdAt: Date;
}

/**
 * Persistent store for REAL SEO audit runs. Each snapshot holds the exact
 * network observations (crawls, site checks, PageSpeed, Search Console, LLM
 * probes) captured when the audit was executed, plus the assembled report.
 */
const SeoAuditSnapshotSchema = new Schema<ISeoAuditSnapshot>(
  {
    origin: { type: String, required: true },
    reportRoute: { type: String, required: true, default: "/" },
    report: { type: Schema.Types.Mixed, required: true },
    crawls: { type: [Schema.Types.Mixed], default: [] },
    siteChecks: { type: Schema.Types.Mixed, default: null },
    gsc: { type: Schema.Types.Mixed, default: null },
    llm: { type: Schema.Types.Mixed, default: [] },
    pageSpeed: { type: Schema.Types.Mixed, default: null },
    durationMs: { type: Number, default: 0 },
    createdAt: { type: Date, default: Date.now, index: true },
  },
  { timestamps: { createdAt: true, updatedAt: false }, versionKey: false },
);

SeoAuditSnapshotSchema.index({ createdAt: -1 });

export default mongoose.model<ISeoAuditSnapshot>("SeoAuditSnapshot", SeoAuditSnapshotSchema);
