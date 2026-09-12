import mongoose, { Schema } from "mongoose";

const assistanceCardSchema = new Schema(
  {
    id: { type: String, default: "" },
    icon: { type: String, default: "" },
    category: { type: String, default: "" },
    title: { type: String, default: "" },
    percentage: { type: String, default: "" },
    note: { type: String, default: "" },
    badgeText: { type: String, default: "" },
  },
  { _id: false }
);

const msmeFinancialAssistanceSchema = new Schema(
  {
    eyebrow: { type: String, default: "Financial Assistance" },
    eyebrowSub: { type: String, default: "For Eligible MSMEs" },
    headingLine1: { type: String, default: "HOW MUCH SUPPORT CAN" },
    headingLine2: { type: String, default: "YOU GET UNDER PMS?" },
    subtitleLine1: { type: String, default: "The PMS Scheme provides financial assistance to reduce your participation cost" },
    subtitleLine2: { type: String, default: "and help your business grow in new markets." },
    maxAssistanceAmount: { type: String, default: "₹1.50 LAKH" },
    maxAssistanceNote: { type: String, default: "Maximum overall assistance per eligible enterprise / event" },
    cards: {
      type: [assistanceCardSchema],
      default: [
        {
          id: "general",
          icon: "building",
          category: "General Category MSEs",
          title: "Standard General Category",
          percentage: "Up to 80%",
          note: "Of space rent paid (built-up stall)",
          badgeText: "General",
        },
        {
          id: "special",
          icon: "userCheck",
          category: "Special Category MSEs",
          title: "SC / ST / Women / NER / PH",
          percentage: "Up to 100%",
          note: "Of space rent paid (built-up stall)",
          badgeText: "100% Support",
        },
        {
          id: "contingency",
          icon: "truck",
          category: "Contingency Support",
          title: "Travel / Freight / Contingency",
          percentage: "Up to ₹25,000",
          note: "Subject to scheme ceiling & guidelines",
          badgeText: "Add-on",
        },
      ],
    },
  },
  { timestamps: true }
);

const MsmeFinancialAssistance = mongoose.model(
  "OrganicMsmeFinancialAssistance",
  msmeFinancialAssistanceSchema
);
export default MsmeFinancialAssistance;
