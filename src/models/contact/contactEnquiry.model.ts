import mongoose, { Schema } from "mongoose";

const contactEnquirySchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    // Optional here: the contact form's controller still requires it, the chatbot only asks name + mobile
    email: { type: String, default: "", trim: true, lowercase: true },
    // Optional here too: a chat visitor may share only an email (the contact form still requires it)
    phone: { type: String, default: "", trim: true },
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
