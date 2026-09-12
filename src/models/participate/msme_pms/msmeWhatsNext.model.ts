import mongoose, { Schema } from "mongoose";

const msmeWhatsNextSchema = new Schema(
  {
    eyebrow: { type: String, default: "WHAT'S NEXT?" },
    headingLine1: { type: String, default: "Take the Next Step Today" },
    description: {
      type: String,
      default:
        "Join Bharat Organic Expo 2027 and be part of India's fastest growing Organic & Natural marketplace.",
    },
    ctaLabel1: { type: String, default: "CHECK PMS ELIGIBILITY" },
    ctaHref1: { type: String, default: "/participate/msme/eligibility-check" },
    ctaLabel2: { type: String, default: "BOOK YOUR STALL" },
    ctaHref2: { type: String, default: "/registration/book-a-stand" },
    email: { type: String, default: "msme@organicexpo.com" },
    phone: { type: String, default: "+91 9654900525" },
  },
  { timestamps: true }
);

const MsmeWhatsNext = mongoose.model("OrganicMsmeWhatsNext", msmeWhatsNextSchema);
export default MsmeWhatsNext;
