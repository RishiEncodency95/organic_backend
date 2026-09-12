import mongoose, { Schema } from "mongoose";

const reasonItemSchema = new Schema(
  {
    iconKey: { type: String, default: "" },
    label: { type: String, default: "" },
  },
  { _id: false }
);

const benefitItemSchema = new Schema(
  {
    iconKey: { type: String, default: "" },
    label: { type: String, default: "" },
  },
  { _id: false }
);

const partnershipWhySchema = new Schema(
  {
    titleLine1: { type: String, default: "WHY PARTNER WITH" },
    titleLine2: { type: String, default: "BHARAT ORGANIC EXPO 2027?" },
    subtitle: {
      type: String,
      default:
        "Connect with a highly targeted audience, build brand trust and showcase your expertise to thousands of visitors, industry leaders and decision makers.",
    },
    partnerReasons: {
      type: [reasonItemSchema],
      default: [
        { iconKey: "Shield", label: "Build\nBrand Trust" },
        { iconKey: "MapPin", label: "Generate\nQuality Leads" },
        { iconKey: "Network", label: "Expand\nBusiness Network" },
        { iconKey: "ClipboardList", label: "Long-term\nBrand Value" },
      ],
    },
    rightTitle: { type: String, default: "KEY BENEFITS" },
    keyBenefits: {
      type: [benefitItemSchema],
      default: [
        { iconKey: "e1og", label: "High Brand\nVisibility" },
        { iconKey: "e2og", label: "Targeted\nAudience Reach" },
        { iconKey: "e3og", label: "Increase Brand\nCredibility" },
        { iconKey: "e4og", label: "Drive Website\nTraffic & Leads" },
        { iconKey: "e5og", label: "Stronger ROI\n& Engagement" },
      ],
    },
  },
  { timestamps: true }
);

const PartnershipWhy = mongoose.model(
  "OrganicPartnershipWhy",
  partnershipWhySchema
);

export default PartnershipWhy;
