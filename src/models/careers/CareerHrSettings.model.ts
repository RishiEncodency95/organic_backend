import mongoose, { Schema } from "mongoose";

/**
 * Admin Career Settings → HR & Workflow. Recipients are the people an application can be
 * forwarded to; `type` decides whether they get the forward email as To, CC or BCC.
 */
export const RECIPIENT_TYPES = ["to", "cc", "bcc"] as const;
export type RecipientType = (typeof RECIPIENT_TYPES)[number];

export const DEFAULT_HR_RECIPIENTS = [
  { name: "HR Team", designation: "General HR", email: "hr@namogangewellness.com", type: "to", active: true },
  { name: "Recruitment Team", designation: "Recruitment", email: "recruitment@namogangewellness.com", type: "cc", active: true },
];

const recipientSchema = new Schema(
  {
    name: { type: String, default: "" },
    designation: { type: String, default: "" },
    email: { type: String, required: true, trim: true, lowercase: true },
    type: { type: String, enum: RECIPIENT_TYPES, default: "to" },
    active: { type: Boolean, default: true },
  },
  { _id: true }
);

const careerHrSettingsSchema = new Schema(
  {
    key: { type: String, default: "default", unique: true },
    recipients: { type: [recipientSchema], default: () => DEFAULT_HR_RECIPIENTS },
    manualForward: { type: Boolean, default: true },
    notifyHr: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export default mongoose.models.CareerHrSettings || mongoose.model("CareerHrSettings", careerHrSettingsSchema);
