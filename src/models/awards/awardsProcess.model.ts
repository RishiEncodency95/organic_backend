import mongoose, { Schema } from "mongoose";

const processStepSchema = new Schema(
  {
    id: { type: Number },
    image: { type: String, default: "" },
    icon: { type: String, default: "" },
    title: { type: String, default: "" },
    desc: { type: String, default: "" },
    description: { type: String, default: "" },
    shortDescription: { type: String, default: "" },
  },
  { _id: true }
);

const awardsProcessSchema = new Schema(
  {
    enabled: { type: Boolean, default: true },
    eyebrow: { type: String, default: "EVALUATION PROCESS" },
    title: { type: String, default: "Our Evaluation Process" },
    steps: [processStepSchema],
    items: [processStepSchema],
  },
  { timestamps: true }
);

const AwardsProcess = mongoose.model(
  "OrganicAwardsProcess",
  awardsProcessSchema
);
export default AwardsProcess;

