import mongoose, { Schema, Document } from "mongoose";

export interface ICandidateProfile extends Document {
  name?: string;
  email?: string;
  phone?: string;
  /** Every number the CV listed; `phone` is the one the candidate verified. */
  phones?: string[];
  verifiedPhone?: string;
  location?: string;
  photo?: string;
  /** Only set when the CV explicitly states it — never inferred from the name. */
  gender?: "male" | "female";
  education?: string[];
  experience?: string[];
  skills?: string[];
  achievements?: string[];
  languages?: string[];
  linkedin?: string;
  currentCompany?: string;
  currentDesignation?: string;
  totalExperience?: string;
  noticePeriod?: string;
  currentCTC?: string;
  expectedCTC?: string;
  willingToRelocate?: boolean;
  cv: {
    originalFileName: string;
    cloudinaryUrl: string;
    cloudinaryPublicId: string;
    fileType: string;
    fileSize: number;
    rawText?: string;
  };
  createdAt: Date;
  updatedAt: Date;
}

const CandidateProfileSchema: Schema = new Schema(
  {
    name: { type: String, trim: true },
    email: { type: String, trim: true, lowercase: true, index: true },
    phone: { type: String, trim: true },
    phones: [{ type: String, trim: true }],
    verifiedPhone: { type: String, trim: true },
    location: { type: String, trim: true },
    photo: { type: String },
    gender: { type: String, enum: ["male", "female"] },
    education: [{ type: String }],
    experience: [{ type: String }],
    skills: [{ type: String }],
    achievements: [{ type: String }],
    languages: [{ type: String }],
    linkedin: { type: String },
    currentCompany: { type: String },
    currentDesignation: { type: String },
    totalExperience: { type: String },
    noticePeriod: { type: String },
    currentCTC: { type: String },
    expectedCTC: { type: String },
    willingToRelocate: { type: Boolean, default: false },
    cv: {
      originalFileName: { type: String, required: true },
      cloudinaryUrl: { type: String, required: true },
      cloudinaryPublicId: { type: String, required: true },
      fileType: { type: String, required: true },
      fileSize: { type: Number, required: true },
      rawText: { type: String },
    },
  },
  {
    timestamps: true,
  }
);

export default mongoose.models.CandidateProfile ||
  mongoose.model<ICandidateProfile>("CandidateProfile", CandidateProfileSchema);
