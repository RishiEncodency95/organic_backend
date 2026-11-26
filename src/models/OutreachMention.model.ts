import mongoose, { Schema } from "mongoose";

/** Unlinked brand mentions found by the search source: drafts may only be written for these. */
const schema = new Schema(
  {
    url: { type: String, required: true, unique: true, trim: true },
    title: { type: String, default: "" },
    snippet: { type: String, default: "" },
    discoveredAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);
const OutreachMention = mongoose.models.OutreachMention || mongoose.model("OutreachMention", schema);
export default OutreachMention;
