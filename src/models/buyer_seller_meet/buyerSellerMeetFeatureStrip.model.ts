import mongoose, { Schema } from "mongoose";

const featureItemSchema = new Schema(
  {
    icon: { type: String, default: "" },
    title: { type: String, default: "" },
    subtitle: { type: String, default: "" },
  },
  { _id: false }
);

const buyerSellerMeetFeatureStripSchema = new Schema(
  {
    features: {
      type: [featureItemSchema],
      default: [
        { icon: "Users", title: "Curated Meetings", subtitle: "Relevant Connections" },
        { icon: "CheckCircle", title: "Verified Business", subtitle: "Profiles" },
        { icon: "Target", title: "Industry Focused", subtitle: "Networking" },
        { icon: "ArrowUpRight", title: "New Opportunities", subtitle: "& Partnerships" },
        { icon: "TrendingUp", title: "Business Growth", subtitle: "& Expansion" },
      ],
    },
  },
  { timestamps: true }
);

const BuyerSellerMeetFeatureStrip = mongoose.model(
  "OrganicBuyerSellerMeetFeatureStrip",
  buyerSellerMeetFeatureStripSchema
);

export default BuyerSellerMeetFeatureStrip;
