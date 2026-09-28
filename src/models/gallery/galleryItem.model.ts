import mongoose, { Document, Schema } from "mongoose";

export interface IGalleryItem extends Document {
  title: string;
  year: string;
  category: string;
  image: string;
  imageAlt?: string;
  uploadedBy: string;
  date: string;
  time: string;
  status: "Published" | "Draft";
  order: number;
  size?: string;
  createdAt: Date;
  updatedAt: Date;
}

const galleryItemSchema = new Schema<IGalleryItem>(
  {
    title: {
      type: String,
      default: "",
      trim: true,
    },
    year: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    category: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    image: {
      type: String,
      required: true,
      trim: true,
    },
    imageAlt: {
      type: String,
      default: "",
      trim: true,
    },
    uploadedBy: {
      type: String,
      default: "Vansh Chaudhary",
      trim: true,
    },
    date: {
      type: String,
      default: "",
    },
    time: {
      type: String,
      default: "",
    },
    status: {
      type: String,
      enum: ["Published", "Draft"],
      default: "Published",
      index: true,
    },
    order: {
      type: Number,
      default: 1,
      index: true,
    },
    size: {
      type: String,
      default: "",
    },
  },
  {
    timestamps: true,
  }
);

const GalleryItem = mongoose.model<IGalleryItem>("GalleryItem", galleryItemSchema);
export default GalleryItem;
