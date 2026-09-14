import mongoose, { Schema } from "mongoose";

const awardsGrandAwardsSchema = new Schema(
  {
    enabled: { type: Boolean, default: true },
    title: { type: String, default: "Prestigious Grand Awards" },
    awards: [
      {
        id: { type: Number },
        icon: { type: String, default: "" },
        label: { type: String, default: "" },
      },
    ],
  },
  { timestamps: true }
);

const AwardsGrandAwards = mongoose.model(
  "OrganicAwardsGrandAwards",
  awardsGrandAwardsSchema
);
export default AwardsGrandAwards;
