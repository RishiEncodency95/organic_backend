import mongoose, { Schema } from "mongoose";

const exhibitorItemSchema = new Schema(
  {
    title: { type: String, default: "" },
    name: { type: String, default: "" },
    location: { type: String, default: "India" },
    category: { type: String, default: "ORGANIC FOOD" },
    order: { type: Number, default: 0 },
    websiteUrl: { type: String, default: "" },
    image: { type: String, default: "" },
    logo: { type: String, default: "" },
    altText: { type: String, default: "" },
    status: { type: String, enum: ["Published", "Draft"], default: "Published" },
    fileSize: { type: String, default: "15.0 KB" },
    updatedBy: { type: String, default: "Vansh Chaudhary" },
  },
  { timestamps: true }
);

// Pre-save hook to ensure title <-> name and image <-> logo consistency
exhibitorItemSchema.pre("save", function () {
  if (!this.title && this.name) this.title = this.name;
  if (!this.name && this.title) this.name = this.title;
  if (!this.image && this.logo) this.image = this.logo;
  if (!this.logo && this.image) this.logo = this.image;
});

const ExhibitorItem = mongoose.model("OrganicExhibitorItem", exhibitorItemSchema);
export default ExhibitorItem;

