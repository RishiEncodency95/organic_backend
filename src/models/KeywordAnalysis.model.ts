import mongoose, { Document, Schema } from "mongoose";

/**
 * The AI's analysis of one page address (primary keyword, related keywords, estimates), saved so the same page is not
 * analysed (and paid for) again while its text is unchanged. `contentHash` is the page's own words: when the page
 * changes, the saved analysis is no longer used and a new one is made. The numbers are the AI model's estimates, not
 * measurements, and are always shown that way.
 */
export interface IKeywordAnalysis extends Document {
  url: string;
  contentHash: string;
  version: number;
  primaryRecommendation: string | null;
  lsiKeywords: string[];
  variations: Array<{
    keyword: string;
    searchVolume: number;
    difficulty: number;
    cpc: number;
    intent: string;
    competition: string;
    onPage: boolean;
    usedOnPage: number;
  }>;
  analysedAt: Date;
}

const schema = new Schema<IKeywordAnalysis>(
  {
    url: { type: String, required: true, index: true },
    contentHash: { type: String, required: true },
    version: { type: Number, default: 1 },
    primaryRecommendation: { type: String, default: null },
    lsiKeywords: { type: [String], default: [] },
    variations: { type: Schema.Types.Mixed, default: [] },
    analysedAt: { type: Date, default: () => new Date() },
  },
  { versionKey: false },
);
schema.index({ url: 1, contentHash: 1, version: 1 }, { unique: true });

const KeywordAnalysis = mongoose.models.KeywordAnalysis || mongoose.model<IKeywordAnalysis>("KeywordAnalysis", schema);
export default KeywordAnalysis;
