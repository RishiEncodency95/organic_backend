import mongoose, { Schema } from "mongoose";

/**
 * "Share Your Feedback" form on the website (/feedback). Listed in admin → Feedback.
 * `consentToFeature` is the visitor's answer to "May we feature your experience?" —
 * only feedback with it set may be used as a testimonial.
 */
const feedbackSchema = new Schema(
  {
    role: { type: String, required: true, trim: true },
    name: { type: String, required: true, trim: true },
    company: { type: String, required: true, trim: true },
    designation: { type: String, default: "", trim: true },
    // 10-digit Indian mobile number
    phone: { type: String, required: true, trim: true },
    email: { type: String, default: "", trim: true, lowercase: true },
    edition: { type: String, required: true, trim: true },
    // 1–5 stars; 0 = not rated (only the overall rating is required)
    ratings: {
      overall: { type: Number, required: true, min: 1, max: 5 },
      networking: { type: Number, default: 0, min: 0, max: 5 },
      quality: { type: Number, default: 0, min: 0, max: 5 },
      management: { type: Number, default: 0, min: 0, max: 5 },
    },
    valuable: { type: String, required: true, trim: true },
    improve: { type: String, default: "", trim: true },
    consentToFeature: { type: Boolean, default: false },
    wantsContact: { type: Boolean, default: false },
    photo: { type: String, default: "" },
    logo: { type: String, default: "" },
    status: {
      type: String,
      default: "new",
      enum: ["new", "reviewed", "contacted"],
      index: true,
    },
  },
  { timestamps: true }
);

export default mongoose.models.Feedback || mongoose.model("Feedback", feedbackSchema);
