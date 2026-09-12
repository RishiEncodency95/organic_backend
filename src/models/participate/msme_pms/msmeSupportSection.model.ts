import mongoose, { Schema } from "mongoose";

const journeyStepSchema = new Schema(
  {
    stepNumber: { type: Number, default: 1 },
    title: { type: String, default: "" },
    description: { type: String, default: "" },
  },
  { _id: false }
);

const msmeSupportSectionSchema = new Schema(
  {
    titleLine1: { type: String, default: "How to Apply" },
    titleLine2: { type: String, default: "& Get PMS Support" },
    subtitleLine1: { type: String, default: "Simple 4-step process to check eligibility," },
    subtitleLine2: { type: String, default: "participate and claim your government assistance." },
    journeySteps: {
      type: [journeyStepSchema],
      default: [
        {
          stepNumber: 1,
          title: "Check Eligibility",
          description: "Verify Udyam registration and product category alignment with PMS guidelines.",
        },
        {
          stepNumber: 2,
          title: "Book Stall",
          description: "Reserve your exhibition space at Bharat Organic Expo 2027.",
        },
        {
          stepNumber: 3,
          title: "Submit Documents",
          description: "Provide required Udyam certificate, invoices and participation details.",
        },
        {
          stepNumber: 4,
          title: "Claim Reimbursement",
          description: "Post-event claim submission for space rent reimbursement directly to your bank account.",
        },
      ],
    },
    contactPhone: { type: String, default: "+91 9654900525" },
    contactEmail: { type: String, default: "msme@organicexpo.com" },
  },
  { timestamps: true }
);

const MsmeSupportSection = mongoose.model("OrganicMsmeSupportSection", msmeSupportSectionSchema);
export default MsmeSupportSection;
