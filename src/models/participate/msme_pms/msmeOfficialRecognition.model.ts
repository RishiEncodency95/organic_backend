import mongoose, { Schema } from "mongoose";

const badgeSchema = new Schema(
  {
    text: { type: String, default: "" },
  },
  { _id: false }
);

const certificateSchema = new Schema(
  {
    pdfUrl: { type: String, default: "" },
    previewImg: { type: String, default: "" },
    verifiedText: { type: String, default: "Approved Event Certificate" },
  },
  { _id: false }
);

const msmeOfficialRecognitionSchema = new Schema(
  {
    badge: { type: badgeSchema, default: () => ({ text: "Officially Approved Event" }) },
    headingLine1: { type: String, default: "Approved Under" },
    headingLine2: { type: String, default: "PMS Scheme Guidelines" },
    subheadingLine1: { type: String, default: "Bharat Organic Expo 2027 is an approved trade fair under" },
    subheadingLine2: {
      type: String,
      default: "the Procurement and Marketing Support (PMS) Scheme of Ministry of MSME, Govt. of India.",
    },
    ctaLabel: { type: String, default: "APPLY FOR PMS SUPPORT" },
    ctaHref: { type: String, default: "/participate/msme/apply/payment" },
    disclaimerText: {
      type: String,
      default:
        "Event approval does not guarantee reimbursement. Individual eligibility, documentation and final sanction are subject to applicable PMS Scheme guidelines and decision of the competent authority.",
    },
    certificate: { type: certificateSchema, default: () => ({}) },
  },
  { timestamps: true }
);

const MsmeOfficialRecognition = mongoose.model(
  "OrganicMsmeOfficialRecognition",
  msmeOfficialRecognitionSchema
);
export default MsmeOfficialRecognition;
