import mongoose, { Schema } from "mongoose";

const partnershipEnquirySchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    organization: { type: String, required: true, trim: true },
    email: { type: String, required: true, trim: true, lowercase: true },
    phone: { type: String, required: true, trim: true },
    category: { type: String, required: true, trim: true },
    message: { type: String, default: "", trim: true },
    eventName: { type: String, default: "BOE2026", trim: true },
    status: {
      type: String,
      default: "pending",
      enum: ["pending", "contacted", "resolved"],
    },
  },
  { timestamps: true }
);

// Not "OrganicPartnershipEnquiry" — that name is already taken by the partnership form's CMS
// section content (models/opportunities/partnershipEnquiry.model.ts). This one stores submissions.
const PartnershipEnquiry = mongoose.model("OrganicPartnershipSubmission", partnershipEnquirySchema);
export default PartnershipEnquiry;
