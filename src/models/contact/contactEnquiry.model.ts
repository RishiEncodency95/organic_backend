import mongoose, { Schema } from "mongoose";

const contactEnquirySchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, trim: true, lowercase: true },
    phone: { type: String, required: true, trim: true },
    alternatePhone: { type: String, default: "", trim: true },
    subject: { type: String, default: "", trim: true },
    service: { type: String, default: "", trim: true },
    message: { type: String, required: true, trim: true },
    eventName: { type: String, default: "BOE2026", trim: true },
    status: {
      type: String,
      default: "pending",
      enum: ["pending", "contacted", "resolved"],
    },
  },
  { timestamps: true }
);

const ContactEnquiry = mongoose.model(
  "OrganicContactEnquiry",
  contactEnquirySchema
);
export default ContactEnquiry;
