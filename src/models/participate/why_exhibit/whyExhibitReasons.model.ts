import mongoose, { Schema } from "mongoose";

const reasonItemSchema = new Schema(
  {
    img: { type: String, default: "" },
    title1: { type: String, required: true },
    title2: { type: String, default: "" },
    descLines: { type: [String], default: [] },
    points: { type: [String], default: [] },
  },
  { timestamps: true }
);

const WhyExhibitReasons = mongoose.model("OrganicWhyExhibitReasons", reasonItemSchema);
export default WhyExhibitReasons;
