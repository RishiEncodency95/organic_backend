import mongoose, { Schema, Document } from "mongoose";

export interface IBlogHero extends Document {
  tagline?: string;
  titlePart1?: string;
  titlePart2?: string;
  subtitle?: string;
  description?: string;
  image?: string;
  imageAlt?: string;
  secondaryImage?: string;
}

const BlogHeroSchema = new Schema<IBlogHero>(
  {
    tagline: { type: String },
    titlePart1: { type: String },
    titlePart2: { type: String },
    subtitle: { type: String },
    description: { type: String },
    image: { type: String },
    imageAlt: { type: String },
    secondaryImage: { type: String },
  },
  { timestamps: true }
);

export default mongoose.model<IBlogHero>("BlogHero", BlogHeroSchema);
