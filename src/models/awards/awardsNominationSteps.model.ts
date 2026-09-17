import mongoose, { Schema } from "mongoose";

const nominationStepSchema = new Schema(
  {
    id: { type: Number },
    num: { type: String, default: "" },
    title: { type: String, default: "" },
    desc: { type: String, default: "" },
    description: { type: String, default: "" },
    shortDescription: { type: String, default: "" },
    image: { type: String, default: "" },
    icon: { type: String, default: "" },
  },
  { _id: true }
);

const awardsNominationStepsSchema = new Schema(
  {
    enabled: { type: Boolean, default: true },
    title: { type: String, default: "THE AWARD PROCESS" },
    steps: [nominationStepSchema],
    items: [nominationStepSchema],
  },
  { timestamps: true }
);

const AwardsNominationSteps = mongoose.model(
  "OrganicAwardsNominationSteps",
  awardsNominationStepsSchema
);

export default AwardsNominationSteps;
