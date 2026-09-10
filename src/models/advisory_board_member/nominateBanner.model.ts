import mongoose, { Schema, Document } from "mongoose";

export interface INominateBanner extends Document {
  tagline?: string;
  titlePart1?: string;
  titlePart2?: string;
  description?: string;
  features?: Array<{
    icon?: string;
    titlePart1?: string;
    titlePart2?: string;
  }>;
  buttonText?: string;
  buttonLink?: string;
}

const NominateBannerSchema = new Schema<INominateBanner>(
  {
    tagline: { type: String },
    titlePart1: { type: String },
    titlePart2: { type: String },
    description: { type: String },
    features: [
      {
        icon: { type: String },
        titlePart1: { type: String },
        titlePart2: { type: String },
      },
    ],
    buttonText: { type: String },
    buttonLink: { type: String },
  },
  { timestamps: true }
);

export default mongoose.model<INominateBanner>("NominateBanner", NominateBannerSchema);
