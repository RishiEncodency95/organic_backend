import mongoose, { Schema } from "mongoose";

const featureItemSchema = new Schema(
  {
    icon: { type: String, default: "" },
    title: { type: String, default: "" },
    description: { type: String, default: "" },
  },
  { _id: false }
);

const msmeFeatureStripSchema = new Schema(
  {
    items: {
      type: [featureItemSchema],
      default: [
        {
          icon: "officialMessage",
          title: "Official Message",
          description: "Direct message from MSME Leadership",
        },
        {
          icon: "forAllMsmes",
          title: "For All MSMEs",
          description: "Encouragement for every entrepreneur across India",
        },
        {
          icon: "governmentSupport",
          title: "Government Support",
          description: "Strong support for growth, competitiveness & global reach",
        },
      ],
    },
  },
  { timestamps: true }
);

const MsmeFeatureStrip = mongoose.model("OrganicMsmeFeatureStrip", msmeFeatureStripSchema);
export default MsmeFeatureStrip;
