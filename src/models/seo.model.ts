import mongoose, { Document, Schema } from "mongoose";

export interface ISeo extends Document {
  page: string;
  metaTitle?: string;
  metaDescription?: string;
  metaKeywords?: string;
  canonicalUrl?: string;
  canonicalTag?: string;
  openGraphTags?: string;
  schemaMarkup?: string;
  ogTitle?: string;
  ogDescription?: string;
  ogImage?: string;
  robotsIndex: boolean;
  robotsFollow: boolean;
  isActive: boolean;
  updatedBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

const seoSchema = new Schema<ISeo>(
  {
    page: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
      index: true,
    },
    metaTitle: {
      type: String,
      trim: true,
      default: "",
    },
    metaDescription: {
      type: String,
      trim: true,
      default: "",
    },
    metaKeywords: {
      type: String,
      trim: true,
      default: "",
    },
    canonicalUrl: {
      type: String,
      trim: true,
      default: "",
    },
    canonicalTag: {
      type: String,
      trim: true,
      default: "",
    },
    openGraphTags: {
      type: String,
      default: "",
    },
    schemaMarkup: {
      type: String,
      default: "",
    },
    ogTitle: {
      type: String,
      trim: true,
      default: "",
    },
    ogDescription: {
      type: String,
      trim: true,
      default: "",
    },
    ogImage: {
      type: String,
      trim: true,
      default: "",
    },
    robotsIndex: {
      type: Boolean,
      default: true,
    },
    robotsFollow: {
      type: Boolean,
      default: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    updatedBy: {
      type: String,
      default: "Admin User",
    },
  },
  {
    timestamps: true,
  }
);

const Seo = mongoose.models.Seo || mongoose.model<ISeo>("Seo", seoSchema);
export default Seo;
