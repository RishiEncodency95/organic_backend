import mongoose, { Document, Schema } from "mongoose";

export interface IGalleryHero extends Document {
  enabled: boolean;
  title: string;
  subtitle: string;
  shortDescription: string;
  rightImage: string;
  createdAt: Date;
  updatedAt: Date;
}

const galleryHeroSchema = new Schema<IGalleryHero>(
  {
    enabled: {
      type: Boolean,
      default: true,
    },
    title: {
      type: String,
      default: "GLIMPSES",
      trim: true,
    },
    subtitle: {
      type: String,
      default: "Moments of Knowledge, Collaboration & Wellness",
      trim: true,
    },
    shortDescription: {
      type: String,
      default:
        "Relive the inspiring moments from past editions of Organic Expo where experts, researchers and industry leaders came together to shape the future of organic trade and sustainable living.",
      trim: true,
    },
    rightImage: {
      type: String,
      default:
        "",
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

const GalleryHero = mongoose.model<IGalleryHero>("GalleryHero", galleryHeroSchema);
export default GalleryHero;
