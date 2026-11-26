import mongoose, { Document, Schema } from "mongoose";

export interface IContextSnippet {
  term: string;
  fromSentence?: string;
  toSentence?: string;
}

/** A suggested internal link (fromPath -> toPath) found by text similarity; "applied" ones are served to the website. */
export interface IInternalLinkSuggestion extends Document {
  fromPath: string;
  toPath: string;
  anchorText: string;
  /** The anchor words really appear in the page that gets the link */
  anchorPlaced?: boolean;
  /** The sentence of the page that carries the link */
  anchorContext?: string;
  similarity: number;
  sharedTerms: string[];
  fromTitle?: string;
  toTitle?: string;
  fromExcerpt?: string;
  toExcerpt?: string;
  contextSnippets?: IContextSnippet[];
  status: "suggested" | "applied" | "dismissed";
  appliedBy?: string;
  appliedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const schema = new Schema<IInternalLinkSuggestion>(
  {
    fromPath: { type: String, required: true, trim: true },
    toPath: { type: String, required: true, trim: true },
    anchorText: { type: String, required: true, trim: true, maxlength: 120 },
    anchorPlaced: { type: Boolean, default: false },
    anchorContext: { type: String, default: "" },
    similarity: { type: Number, required: true },
    sharedTerms: { type: [String], default: [] },
    fromTitle: { type: String, default: "" },
    toTitle: { type: String, default: "" },
    fromExcerpt: { type: String, default: "" },
    toExcerpt: { type: String, default: "" },
    contextSnippets: {
      type: [
        {
          term: { type: String, default: "" },
          fromSentence: { type: String, default: "" },
          toSentence: { type: String, default: "" },
        },
      ],
      default: [],
    },
    status: { type: String, enum: ["suggested", "applied", "dismissed"], default: "suggested", index: true },
    appliedBy: { type: String },
    appliedAt: { type: Date },
  },
  { timestamps: true }
);
schema.index({ fromPath: 1, toPath: 1 }, { unique: true });

const InternalLinkSuggestion =
  mongoose.models.InternalLinkSuggestion || mongoose.model<IInternalLinkSuggestion>("InternalLinkSuggestion", schema);
export default InternalLinkSuggestion;
