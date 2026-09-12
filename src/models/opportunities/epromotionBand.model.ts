import mongoose, { Schema } from "mongoose";

const featureItemSchema = new Schema(
  {
    iconKey: { type: String, default: "" },
    title: { type: String, default: "" },
    subtitle: { type: String, default: "" },
  },
  { _id: false }
);

const epromotionBandSchema = new Schema(
  {
    features: {
      type: [featureItemSchema],
      default: [
        { iconKey: "Users", title: "Curated Meetings", subtitle: "Relevant Connections" },
        { iconKey: "CheckCircle", title: "Verified Business", subtitle: "Profiles" },
        { iconKey: "Target", title: "Industry Focused", subtitle: "Networking" },
        { iconKey: "ArrowUpRight", title: "New Opportunities", subtitle: "& Partnerships" },
        { iconKey: "TrendingUp", title: "Business Growth", subtitle: "& Expansion" },
      ],
    },
  },
  { timestamps: true }
);

const EPromotionBand = mongoose.model(
  "OrganicEPromotionBand",
  epromotionBandSchema
);

export default EPromotionBand;
