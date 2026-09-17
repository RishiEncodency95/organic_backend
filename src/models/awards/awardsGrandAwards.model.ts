import mongoose, { Schema } from "mongoose";

const awardItemSchema = new Schema(
  {
    id: { type: Number },
    title: { type: String, default: "" },
    label: { type: String, default: "" },
    image: { type: String, default: "" },
    icon: { type: String, default: "" },
  },
  { _id: true }
);

const awardsGrandAwardsSchema = new Schema(
  {
    enabled: { type: Boolean, default: true },
    eyebrow: { type: String, default: "GRAND HONOURS" },
    title: { type: String, default: "Prestigious Grand Awards" },
    awards: [awardItemSchema],
    items: [awardItemSchema],
  },
  { timestamps: true }
);

const AwardsGrandAwards = mongoose.model(
  "OrganicAwardsGrandAwards",
  awardsGrandAwardsSchema
);
export default AwardsGrandAwards;

