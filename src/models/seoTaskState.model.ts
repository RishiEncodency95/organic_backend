import mongoose, { Document, Schema } from "mongoose";

export interface ISeoTaskState extends Document {
  /** Id of the site audit check (1-223). One progress record per check. */
  checkId: number;
  status: "open" | "in_progress" | "done";
  note: string | null;
  updatedBy: string | null;
  updatedAt: Date;
}

/** Progress of the fix tasks. A task is a failing check of the audit, so progress is kept per check, across audits. */
const SeoTaskStateSchema = new Schema<ISeoTaskState>(
  {
    checkId: { type: Number, required: true, unique: true, index: true },
    status: { type: String, enum: ["open", "in_progress", "done"], default: "open" },
    note: { type: String, default: null },
    updatedBy: { type: String, default: null },
    updatedAt: { type: Date, default: Date.now },
  },
  { versionKey: false },
);

export default mongoose.model<ISeoTaskState>("SeoTaskState", SeoTaskStateSchema);
