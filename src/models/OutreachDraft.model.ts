import mongoose, { Document, Schema } from "mongoose";

/** An outreach email draft for a page that mentions the brand without linking to the site. */
export interface IOutreachDraft extends Document {
  mentionUrl: string;
  mentionTitle: string;
  mentionSnippet: string;
  subject: string;
  body: string;
  provider: string;
  status: "draft" | "pushing" | "pushed" | "failed";
  pushedAt?: Date;
  error?: string;
  createdBy?: string;
  createdAt: Date;
}

const schema = new Schema<IOutreachDraft>(
  {
    mentionUrl: { type: String, required: true, unique: true, trim: true },
    mentionTitle: { type: String, default: "" },
    mentionSnippet: { type: String, default: "" },
    subject: { type: String, required: true },
    body: { type: String, required: true },
    provider: { type: String, default: "" },
    status: { type: String, enum: ["draft", "pushing", "pushed", "failed"], default: "draft", index: true },
    pushedAt: { type: Date },
    error: { type: String },
    createdBy: { type: String },
  },
  { timestamps: true }
);

const OutreachDraft = mongoose.models.OutreachDraft || mongoose.model<IOutreachDraft>("OutreachDraft", schema);
export default OutreachDraft;
