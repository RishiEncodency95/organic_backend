import mongoose, { Schema } from "mongoose";

const awardsCategoriesSchema = new Schema(
  {
    enabled: { type: Boolean, default: true },
    eyebrow: { type: String, default: "AWARD CATEGORIES" },
    title: { type: String, default: "Award Categories" },
    categories: [
      {
        id: { type: Number },
        icon: { type: String, default: "" },
        image: { type: String, default: "" },
        title: { type: String, default: "" },
        items: [{ type: String }],
        points: [{ type: String }],
        keyPoint1: { type: String, default: "" },
        keyPoint2: { type: String, default: "" },
        keyPoint3: { type: String, default: "" },
        keyPoint4: { type: String, default: "" },
        cardBg: { type: String, default: "" },
      },
    ],
    items: [
      {
        id: { type: Number },
        icon: { type: String, default: "" },
        image: { type: String, default: "" },
        title: { type: String, default: "" },
        items: [{ type: String }],
        points: [{ type: String }],
        keyPoint1: { type: String, default: "" },
        keyPoint2: { type: String, default: "" },
        keyPoint3: { type: String, default: "" },
        keyPoint4: { type: String, default: "" },
        cardBg: { type: String, default: "" },
      },
    ],
  },
  { timestamps: true }
);

const AwardsCategories = mongoose.model("OrganicAwardsCategories", awardsCategoriesSchema);
export default AwardsCategories;
