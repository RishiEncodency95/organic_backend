import mongoose, { Schema } from "mongoose";

const statItemSchema = new Schema(
  {
    val: { type: String, required: true },
    label: { type: String, required: true },
    iconName: { type: String, default: "Users" },
  },
  { timestamps: true }
);

const WhyExhibitStatsBand = mongoose.model("OrganicWhyExhibitStatsBand", statItemSchema);
export default WhyExhibitStatsBand;
