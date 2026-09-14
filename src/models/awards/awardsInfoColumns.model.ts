import mongoose, { Schema } from "mongoose";

const awardsInfoColumnsSchema = new Schema(
  {
    enabled: { type: Boolean, default: true },
    keyDates: {
      title: { type: String, default: "Key Dates" },
      icon: { type: String, default: "Calendar" },
      disclaimer: { type: String, default: "*Dates are subject to change." },
      items: [
        {
          label: { type: String, default: "" },
          value: { type: String, default: "" },
        },
      ],
    },
    whoCanApply: {
      title: { type: String, default: "Who Can Apply?" },
      icon: { type: String, default: "Users" },
      note: {
        type: String,
        default: "Open to Indian & International participants.",
      },
      items: [{ type: String }],
    },
    whyParticipate: {
      title: { type: String, default: "Why Participate?" },
      icon: { type: String, default: "Star" },
      items: [{ type: String }],
    },
  },
  { timestamps: true }
);

const AwardsInfoColumns = mongoose.model(
  "OrganicAwardsInfoColumns",
  awardsInfoColumnsSchema
);
export default AwardsInfoColumns;
