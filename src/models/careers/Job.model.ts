import mongoose, { Schema, Document } from "mongoose";

export interface IJob extends Document {
  title: string;
  slug: string;
  company: string;
  department: string;
  location: string;
  employmentType: string; // e.g. Full-time, Part-time, Contract
  experienceMin: number;
  experienceMax: number;
  educationRequirements?: string;
  skills: string[];
  responsibilities: string[];
  requirements: string[];
  preferredQualifications?: string[];
  salary?: string;
  eligibilityThreshold: number; // default 40
  status: "DRAFT" | "OPEN" | "CLOSED";
  publishedAt?: Date;
  closedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const JobSchema: Schema = new Schema(
  {
    title: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, index: true },
    company: { type: String, default: "Bharat Organic Expo 2027" },
    department: { type: String, required: true, trim: true },
    location: { type: String, required: true, trim: true },
    employmentType: { type: String, default: "Full-time" },
    experienceMin: { type: Number, default: 0 },
    experienceMax: { type: Number, default: 10 },
    educationRequirements: { type: String },
    skills: [{ type: String, trim: true }],
    responsibilities: [{ type: String }],
    requirements: [{ type: String }],
    preferredQualifications: [{ type: String }],
    salary: { type: String },
    eligibilityThreshold: { type: Number, default: 40 },
    status: {
      type: String,
      enum: ["DRAFT", "OPEN", "CLOSED"],
      default: "OPEN",
      index: true,
    },
    publishedAt: { type: Date, default: Date.now },
    closedAt: { type: Date },
  },
  {
    timestamps: true,
  }
);

export default mongoose.models.Job || mongoose.model<IJob>("Job", JobSchema);
