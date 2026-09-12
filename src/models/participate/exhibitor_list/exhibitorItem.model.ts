import mongoose, { Schema } from "mongoose";

const exhibitorItemSchema = new Schema(
  {
    title: { type: String, required: true },
    location: { type: String, default: "India" },
    category: { type: String, required: true },
    order: { type: Number, default: 0 },
    websiteUrl: { type: String, default: "" },
    image: { type: String, default: "" },
    altText: { type: String, default: "" },
  },
  { timestamps: true }
);

const ExhibitorItem = mongoose.model("OrganicExhibitorItem", exhibitorItemSchema);
export default ExhibitorItem;
