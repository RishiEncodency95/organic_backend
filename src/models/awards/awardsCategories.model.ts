import mongoose, { Schema } from "mongoose";

const awardsCategoriesSchema = new Schema(
  {
    enabled: { type: Boolean, default: true },
    title: { type: String, default: "Award Categories" },
    categories: [
      {
        id: { type: Number },
        icon: { type: String, default: "" },
        title: { type: String, default: "" },
        items: [{ type: String }],
        cardBg: { type: String, default: "" },
      },
    ],
  },
  { timestamps: true }
);

const AwardsCategories = mongoose.model("OrganicAwardsCategories", awardsCategoriesSchema);
export default AwardsCategories;
