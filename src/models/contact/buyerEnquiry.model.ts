import mongoose, { Schema } from "mongoose";

/**
 * "Buyer Enquiry" popup on the website's Buyer-Seller Meet page. The WhatsApp number is
 * OTP-verified before the enquiry is accepted. Listed in admin → Buyer Enquiries.
 */
const buyerEnquirySchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    company: { type: String, default: "", trim: true },
    // 10-digit Indian mobile number, verified on WhatsApp
    phone: { type: String, required: true, trim: true },
    email: { type: String, required: true, trim: true, lowercase: true },
    city: { type: String, default: "", trim: true },
    country: { type: String, default: "", trim: true },
    buyerType: { type: String, default: "", trim: true },
    enquiryAbout: { type: String, required: true, trim: true },
    message: { type: String, required: true, trim: true },
    eventName: { type: String, default: "BOE2027", trim: true },
    status: {
      type: String,
      default: "pending",
      enum: ["pending", "contacted", "resolved"],
      index: true,
    },
  },
  { timestamps: true }
);

export default mongoose.models.BuyerEnquiry || mongoose.model("BuyerEnquiry", buyerEnquirySchema);
