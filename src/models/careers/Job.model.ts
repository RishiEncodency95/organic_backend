import mongoose, { Schema, Document } from "mongoose";

export interface IJob extends Document {
  title: string;
  slug: string;
  designation?: string;
  company: string;
  projectEvent?: string;
  department: string;
  jobCode?: string;
  location: string;
  employmentType: string; // e.g. Full Time, Part Time, Contract
  workplaceType?: string; // On-site (Office), Remote, Hybrid
  totalOpenings: number;
  experienceMin: number;
  experienceMax: number;
  educationRequirements?: string;

  // Compensation
  ctcMin?: number;
  ctcMax?: number;
  salaryType?: string;
  performanceIncentiveApplicable: boolean;
  incentiveType?: string;
  salary?: string;

  // Job description
  description?: string; // "The Opportunity" paragraph shown on the careers site and job cards
  aboutCompany?: string; // rich text HTML (currently unused by the public site)
  roleObjective?: string; // rich text HTML (currently unused by the public site)
  skills: string[]; // required key skills
  preferredSkills?: string[];
  targetIndustrySegments?: string[];
  specificExperience?: string;
  responsibilities: string[];
  requirements: string[];
  preferredQualifications?: string[];

  // Application & AI screening
  acceptOnlineApplications: boolean;
  aiCvScreening: boolean;
  cvUploadMandatory: boolean;
  candidatePhotoMandatory: boolean;
  allowFresherCandidates: boolean;
  allowCurrentlyNotEmployed: boolean;
  allowCvReplacement: boolean;
  eligibilityThreshold: number; // minimum passing score %, default 40
  partialMatchMin?: number;
  partialMatchMax?: number;
  showMatchScoreToCandidate: boolean;
  showMatchBreakdown: boolean;

  // Visibility & scheduling
  featuredJob: boolean;
  applicationOpenDate?: Date;
  applicationClosingDate?: Date;
  tags?: string[];

  // Stats
  views: number;

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
    designation: { type: String, trim: true },
    company: { type: String, default: "Bharat Organic Expo 2027" },
    projectEvent: { type: String, trim: true },
    department: { type: String, required: true, trim: true },
    jobCode: { type: String, trim: true },
    location: { type: String, required: true, trim: true },
    employmentType: { type: String, default: "Full Time" },
    workplaceType: { type: String, default: "On-site (Office)" },
    totalOpenings: { type: Number, default: 1 },
    experienceMin: { type: Number, default: 0 },
    experienceMax: { type: Number, default: 10 },
    educationRequirements: { type: String },

    ctcMin: { type: Number },
    ctcMax: { type: Number },
    salaryType: { type: String, default: "CTC (Cost to Company)" },
    performanceIncentiveApplicable: { type: Boolean, default: false },
    incentiveType: { type: String },
    salary: { type: String },

    description: { type: String },
    aboutCompany: { type: String },
    roleObjective: { type: String },
    skills: [{ type: String, trim: true }],
    preferredSkills: [{ type: String, trim: true }],
    targetIndustrySegments: [{ type: String, trim: true }],
    specificExperience: { type: String },
    responsibilities: [{ type: String }],
    requirements: [{ type: String }],
    preferredQualifications: [{ type: String }],

    acceptOnlineApplications: { type: Boolean, default: true },
    aiCvScreening: { type: Boolean, default: true },
    cvUploadMandatory: { type: Boolean, default: true },
    candidatePhotoMandatory: { type: Boolean, default: true },
    allowFresherCandidates: { type: Boolean, default: false },
    allowCurrentlyNotEmployed: { type: Boolean, default: false },
    allowCvReplacement: { type: Boolean, default: true },
    eligibilityThreshold: { type: Number, default: 40 },
    partialMatchMin: { type: Number, default: 50 },
    partialMatchMax: { type: Number, default: 69 },
    showMatchScoreToCandidate: { type: Boolean, default: true },
    showMatchBreakdown: { type: Boolean, default: true },

    featuredJob: { type: Boolean, default: false },
    applicationOpenDate: { type: Date },
    applicationClosingDate: { type: Date },
    tags: [{ type: String, trim: true }],

    views: { type: Number, default: 0 },

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
