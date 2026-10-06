import mongoose, { Schema } from "mongoose";

/**
 * Chatbot Manager (admin) — one document holding the editable draft and the published copy
 * the website chatbot uses. Each section (buttons, answers, forms, rules, settings) is stored
 * as the admin panel's own JSON, so the panel's design can change without a migration.
 */
const versionSchema = new Schema(
  {
    minor: { type: Number, required: true },
    note: { type: String, default: "", trim: true },
    by: { type: String, default: "Admin", trim: true },
    date: { type: Date, default: Date.now },
    // What was published, so "Restore to Draft" can bring it back (kept for the last 20 versions)
    snapshot: { type: Schema.Types.Mixed },
  },
  { _id: false }
);

const chatbotConfigSchema = new Schema(
  {
    key: { type: String, required: true, unique: true, default: "main" },
    draft: { type: Schema.Types.Mixed, default: {} },
    published: { type: Schema.Types.Mixed, default: {} },
    // Draft differs from what is live
    pending: { type: Boolean, default: false },
    versions: { type: [versionSchema], default: [] },
    // Unanswered questions an admin dismissed from the Review Queue (lower-cased)
    dismissedQuestions: { type: [String], default: [] },
  },
  { timestamps: true, minimize: false }
);

const ChatbotConfig = mongoose.model("OrganicChatbotConfig", chatbotConfigSchema);
export default ChatbotConfig;
