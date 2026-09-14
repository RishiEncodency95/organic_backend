import mongoose, { Document, Schema } from "mongoose";

export interface IGalleryMeta extends Document {
  key: string;
  categories: string[];
  years: string[];
  createdAt: Date;
  updatedAt: Date;
}

const galleryMetaSchema = new Schema<IGalleryMeta>(
  {
    key: {
      type: String,
      default: "default_gallery_config",
      unique: true,
      trim: true,
    },
    categories: {
      type: [String],
      default: [],
    },
    years: {
      type: [String],
      default: [],
    },
  },
  {
    timestamps: true,
  }
);

const GalleryMeta = mongoose.model<IGalleryMeta>("GalleryMeta", galleryMetaSchema);
export default GalleryMeta;
