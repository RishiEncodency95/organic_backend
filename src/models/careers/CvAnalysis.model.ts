import mongoose, { Schema, Document } from "mongoose";

export interface ICvAnalysisBreakdown {
  relevantExperience: { score: number; evidence: string[] };
  skills: { score: number; matched: string[]; missing: string[] };
  education: { score: number; evidence: string[] };
  industryExperience: { score: number; evidence: string[] };
  roleFit: { score: number; evidence: string[] };
  location: { score: number; evidence: string[] };
}

export interface ICvAnalysis extends Document {
  candidateId: mongoose.Types.ObjectId;
  jobId: mongoose.Types.ObjectId;
  cvId?: string;
  provider: "OpenAI" | "Gemini";
  status: "UPLOADED" | "PARSING" | "ANALYZING" | "MATCHING" | "COMPLETED" | "FAILED";
  extractedProfile: any;
  matchScore: number; // Deterministic calculation
  eligibilityThreshold: number;
  eligible: boolean;
  breakdown: ICvAnalysisBreakdown;
  matchedRequirements: string[];
  missingRequirements: string[];
  strengths: string[];
  gaps: string[];
  explanation: string;
  analyzedAt?: Date;
  error?: string;
  createdAt: Date;
  updatedAt: Date;
}

const CvAnalysisSchema: Schema = new Schema(
  {
    candidateId: { type: Schema.Types.ObjectId, ref: "CandidateProfile", required: true },
    jobId: { type: Schema.Types.ObjectId, ref: "Job", required: true },
    cvId: { type: String },
    provider: { type: String, enum: ["OpenAI", "Gemini"], default: "OpenAI" },
    status: {
      type: String,
      enum: ["UPLOADED", "PARSING", "ANALYZING", "MATCHING", "COMPLETED", "FAILED"],
      default: "ANALYZING",
    },
    extractedProfile: { type: Schema.Types.Mixed },
    matchScore: { type: Number, default: 0 },
    eligibilityThreshold: { type: Number, default: 40 },
    eligible: { type: Boolean, default: false },
    breakdown: {
      relevantExperience: {
        score: { type: Number, default: 0 },
        evidence: [{ type: String }],
      },
      skills: {
        score: { type: Number, default: 0 },
        matched: [{ type: String }],
        missing: [{ type: String }],
      },
      education: {
        score: { type: Number, default: 0 },
        evidence: [{ type: String }],
      },
      industryExperience: {
        score: { type: Number, default: 0 },
        evidence: [{ type: String }],
      },
      roleFit: {
        score: { type: Number, default: 0 },
        evidence: [{ type: String }],
      },
      location: {
        score: { type: Number, default: 0 },
        evidence: [{ type: String }],
      },
    },
    matchedRequirements: [{ type: String }],
    missingRequirements: [{ type: String }],
    strengths: [{ type: String }],
    gaps: [{ type: String }],
    explanation: { type: String },
    analyzedAt: { type: Date },
    error: { type: String },
  },
  {
    timestamps: true,
  }
);

export default mongoose.models.CvAnalysis ||
  mongoose.model<ICvAnalysis>("CvAnalysis", CvAnalysisSchema);
