import mongoose, { Schema } from "mongoose";

const awardsProcessSchema = new Schema(
  {
    enabled: { type: Boolean, default: true },
    title: { type: String, default: "Our Evaluation Process" },
    steps: [
      {
        id: { type: Number },
        image: { type: String, default: "" },
        title: { type: String, default: "" },
        desc: { type: String, default: "" },
      },
    ],
  },
  { timestamps: true }
);

const AwardsProcess = mongoose.model(
  "OrganicAwardsProcess",
  awardsProcessSchema
);
export default AwardsProcess;
