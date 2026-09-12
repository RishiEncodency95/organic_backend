import mongoose, { Schema } from "mongoose";

const msmeFinalCtaSchema = new Schema(
  {
    tagline: { type: String, default: "JOIN BHARAT ORGANIC EXPO 2027" },
    headingLine1: { type: String, default: "GROW YOUR ORGANIC BUSINESS" },
    headingLine2: { type: String, default: "WITH GOVERNMENT PMS SUPPORT" },
    description: {
      type: String,
      default:
        "Don't miss the opportunity to showcase your products at India's premier organic trade event with space rent reimbursement.",
    },
    primaryCtaLabel: { type: String, default: "CHECK PMS ELIGIBILITY" },
    primaryCtaHref: { type: String, default: "/participate/msme/eligibility-check" },
    secondaryCtaLabel: { type: String, default: "BOOK STALL NOW" },
    secondaryCtaHref: { type: String, default: "/registration/book-a-stand" },
    supportPhone: { type: String, default: "+91 9654900525" },
    supportEmail: { type: String, default: "msme@organicexpo.com" },
  },
  { timestamps: true }
);

const MsmeFinalCta = mongoose.model("OrganicMsmeFinalCta", msmeFinalCtaSchema);
export default MsmeFinalCta;
