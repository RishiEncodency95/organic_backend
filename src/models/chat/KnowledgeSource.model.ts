import mongoose, { Schema } from "mongoose";

/**
 * Text Organic Mitra answers from, added in the Chatbot Manager's "AI Knowledge" tab:
 * a website page (fetched), a document (PDF / DOCX / TXT, extracted) or text typed by the team.
 * "Published" sources are used on the website; "Draft" / "Update pending" only in admin tests.
 */
const knowledgeSourceSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    kind: { type: String, enum: ["web", "pdf", "manual"], required: true },
    url: { type: String, trim: true },
    includeLinked: { type: Boolean, default: false },
    frequency: { type: String, default: "Manually", trim: true },
    topic: { type: String, default: "General", trim: true },
    owner: { type: String, trim: true },
    status: { type: String, enum: ["Published", "Update pending", "Draft"], default: "Draft" },
    // Text the bot uses (live), and a newer fetch waiting for review
    content: { type: String, default: "" },
    pendingContent: { type: String },
    error: { type: String },
    checkedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

const KnowledgeSource = mongoose.model("OrganicKnowledgeSource", knowledgeSourceSchema);
export default KnowledgeSource;
