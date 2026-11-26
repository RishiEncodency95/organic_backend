import mongoose, { Document, Schema } from "mongoose";

export interface ISemrushImport extends Document {
  _id: mongoose.Types.ObjectId;
  issuesFileName: string | null;
  pagesFileName: string | null;
  /** Parsed "issues" file: one entry per Semrush check. */
  issues: unknown[];
  /** Parsed "mega export" file: one entry per page, only the checks that failed. Null when it was not uploaded. */
  pages: unknown[] | null;
  /** Task progress for this upload, keyed by Semrush Issue Id. A new upload starts clean: the new crawl is the proof. */
  taskStates: Record<string, unknown>;
  uploadedBy: string | null;
  createdAt: Date;
}

/**
 * One upload of Semrush Site Audit CSV files. The comparison with our own audit is rebuilt from this plus the latest
 * stored audit every time it is shown, so it always matches the newest audit run.
 */
const SemrushImportSchema = new Schema<ISemrushImport>(
  {
    issuesFileName: { type: String, default: null },
    pagesFileName: { type: String, default: null },
    issues: { type: [Schema.Types.Mixed], default: [] },
    pages: { type: [Schema.Types.Mixed], default: null },
    taskStates: { type: Schema.Types.Mixed, default: {} },
    uploadedBy: { type: String, default: null },
    createdAt: { type: Date, default: Date.now, index: true },
  },
  { timestamps: { createdAt: true, updatedAt: false }, versionKey: false, minimize: false },
);

export default mongoose.model<ISemrushImport>("SemrushImport", SemrushImportSchema);
