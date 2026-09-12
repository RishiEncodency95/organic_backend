import mongoose, { Schema } from "mongoose";

const benefitItemSchema = new Schema(
  {
    iconKey: { type: String, default: "" },
    label: { type: String, default: "" },
  },
  { _id: false }
);

const epromotionWhySchema = new Schema(
  {
    leftTitle: { type: String, default: "WHY E-PROMOTE WITH US?" },
    leftDesc: {
      type: String,
      default:
        "Our e-promotion solutions are designed to give your brand unmatched visibility to a highly engaged and relevant audience across multiple digital touchpoints.",
    },
    rightTitle: { type: String, default: "KEY BENEFITS" },
    benefits: {
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

const EPromotionWhy = mongoose.model(
  "OrganicEPromotionWhy",
  epromotionWhySchema
);

export default EPromotionWhy;
