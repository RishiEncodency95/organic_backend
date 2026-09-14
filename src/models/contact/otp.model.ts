import mongoose, { Schema } from "mongoose";

const otpSchema = new Schema(
  {
    phone: { type: String, trim: true, index: true },
    email: { type: String, trim: true, lowercase: true, index: true },
    otp: { type: String, required: true },
    profile: { type: String, default: "CONTACT_ENQUIRY" },
    name: { type: String, default: "" },
    eventName: { type: String, default: "BOE2026" },
    isVerified: { type: Boolean, default: false },
    expiresAt: {
      type: Date,
      default: () => new Date(Date.now() + 10 * 60 * 1000), // 10 minutes TTL
      index: { expires: "10m" },
    },
  },
  { timestamps: true }
);

const Otp = mongoose.model("OrganicOtp", otpSchema);
export default Otp;
