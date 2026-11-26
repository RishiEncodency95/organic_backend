import mongoose, { Document, Schema } from "mongoose";

export interface ISeoAuditSnapshot extends Document {
  _id: mongoose.Types.ObjectId;
  origin: string;
  reportRoute: string;
  report: unknown;
  crawls: unknown[];
  siteChecks: unknown;
  /** Whether each link found on the crawled pages worked, as a list of { url, status, error }. Null on audits made before links were followed. */
  linkChecks?: unknown;
  gsc: unknown;
  llm: unknown;
  pageSpeed: unknown;
  pageSpeedDesktop?: unknown;
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
    linkChecks: { type: [Schema.Types.Mixed], default: null },
    gsc: { type: Schema.Types.Mixed, default: null },
    llm: { type: Schema.Types.Mixed, default: [] },
    pageSpeed: { type: Schema.Types.Mixed, default: null },
    pageSpeedDesktop: { type: Schema.Types.Mixed, default: null },
    durationMs: { type: Number, default: 0 },
    createdAt: { type: Date, default: Date.now, index: true },
  },
  // minimize: false keeps empty objects. By default Mongoose drops them on save, so a crawled page with no
  // Open Graph / Twitter tags would come back from the database with those fields missing entirely.
  { timestamps: { createdAt: true, updatedAt: false }, versionKey: false, minimize: false },
);

SeoAuditSnapshotSchema.index({ createdAt: -1 });

export default mongoose.model<ISeoAuditSnapshot>("SeoAuditSnapshot", SeoAuditSnapshotSchema);
