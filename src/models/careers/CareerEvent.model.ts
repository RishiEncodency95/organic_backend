import mongoose, { Schema } from "mongoose";

/**
 * Careers page activity counted for the admin Careers Dashboard: the careers page opened
 * ("page_view"), a job's details opened ("job_view") and "Apply Now" clicked ("apply_click").
 * The same IP repeating the same event within 30 minutes counts once. Kept two years.
 */
export const CAREER_EVENT_TYPES = ["page_view", "job_view", "apply_click"] as const;
export type CareerEventType = (typeof CAREER_EVENT_TYPES)[number];

const careerEventSchema = new Schema(
  {
    type: { type: String, enum: CAREER_EVENT_TYPES, required: true },
    jobId: { type: Schema.Types.ObjectId, ref: "Job" },
    ip: { type: String },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);
careerEventSchema.index({ type: 1, createdAt: -1 });
careerEventSchema.index({ ip: 1, type: 1, jobId: 1, createdAt: -1 });
careerEventSchema.index({ createdAt: 1 }, { expireAfterSeconds: 2 * 365 * 24 * 60 * 60 });

export default mongoose.models.CareerEvent || mongoose.model("CareerEvent", careerEventSchema);
