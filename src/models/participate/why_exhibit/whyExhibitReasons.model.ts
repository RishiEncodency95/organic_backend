import mongoose, { Schema } from "mongoose";

const reasonItemSchema = new Schema(
  {
    img: { type: String, default: "" },
    image: { type: String, default: "" },
    title1: { type: String, required: true },
    title2: { type: String, default: "" },
    description: { type: String, default: "" },
    descLines: { type: [String], default: [] },
    feature1: { type: String, default: "" },
    feature2: { type: String, default: "" },
    feature3: { type: String, default: "" },
    features: { type: [String], default: [] },
    points: { type: [String], default: [] },
  },
  { timestamps: true }
);

const WhyExhibitReasons = mongoose.model("OrganicWhyExhibitReasons", reasonItemSchema);
export default WhyExhibitReasons;
