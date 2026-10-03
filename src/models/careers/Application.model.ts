import mongoose, { Schema, Document } from "mongoose";

export type ApplicationStatus =
  | "DRAFT"
  | "CV_UPLOADED"
  | "AI_ANALYZING"
  | "AI_COMPLETED"
  | "APPLICATION_IN_PROGRESS"
  | "SUBMITTED"
  | "UNDER_REVIEW"
  | "SHORTLISTED"
  | "INTERVIEW"
  | "SELECTED"
  | "REJECTED"
  | "WITHDRAWN";

export interface IApplication extends Document {
  applicationId: string; // e.g. BOE2027-000001
  candidateId: mongoose.Types.ObjectId;
  jobId: mongoose.Types.ObjectId;
  cvAnalysisId?: mongoose.Types.ObjectId;
  candidateSnapshot: any;
  scoreSnapshot: any;
  status: ApplicationStatus;
  whyInterested?: string;
  notes?: string;
  submittedAt?: Date;
  hrStatus?: string;
  hrUpdatedAt?: Date;
  hrUpdatedBy?: string;
  hrForward?: {
    recipients: string[];
    share: string[];
    note?: string;
    forwardedAt?: Date;
    forwardedBy?: string;
  };
  createdAt: Date;
  updatedAt: Date;
}

const ApplicationSchema: Schema = new Schema(
  {
    applicationId: { type: String, required: true, unique: true, index: true },
    candidateId: { type: Schema.Types.ObjectId, ref: "CandidateProfile", required: true },
    jobId: { type: Schema.Types.ObjectId, ref: "Job", required: true },
    cvAnalysisId: { type: Schema.Types.ObjectId, ref: "CvAnalysis" },
    candidateSnapshot: { type: Schema.Types.Mixed },
    scoreSnapshot: { type: Schema.Types.Mixed },
    status: {
      type: String,
      enum: [
        "DRAFT",
        "CV_UPLOADED",
        "AI_ANALYZING",
        "AI_COMPLETED",
        "APPLICATION_IN_PROGRESS",
        "SUBMITTED",
        "UNDER_REVIEW",
        "SHORTLISTED",
        "INTERVIEW",
        "SELECTED",
        "REJECTED",
        "WITHDRAWN",
      ],
      default: "DRAFT",
      index: true,
    },
    whyInterested: { type: String },
    notes: { type: String },
    submittedAt: { type: Date },
    // HR pipeline set from the admin "Applications & AI Response" screen. Kept separate from
    // `status` (the candidate's own progress) so forwarding/holding never rewrites it.
    hrStatus: {
      type: String,
      enum: [
        "Not Forwarded",
        "Sent to HR",
        "Under Review",
        "Shortlisted",
        "Interview",
        "Selected",
        "On Hold",
        "Rejected",
      ],
      default: "Not Forwarded",
    },
    hrUpdatedAt: { type: Date },
    hrUpdatedBy: { type: String },
    // Latest "Forward to HR": who it went to and which parts of the application were shared.
    hrForward: {
      recipients: [{ type: String }],
      share: [{ type: String }],
      note: { type: String },
      forwardedAt: { type: Date },
      forwardedBy: { type: String },
    },
  },
  {
    timestamps: true,
  }
);

export default mongoose.models.Application ||
  mongoose.model<IApplication>("Application", ApplicationSchema);
