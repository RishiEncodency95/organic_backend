import mongoose, { Schema, Document } from "mongoose";

// Defaults mirror the text the website showed before this was editable.
export const DEFAULT_BLOG_HERO_BG =
  "https://res.cloudinary.com/ldlcnnhz/image/upload/v1791010203/bharat-organic/blog/hero-bg.webp";

export interface IBlogHero extends Document {
  tagline?: string;
  title?: string;
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
    tagline: { type: String, default: "BHARAT ORGANIC EXPO" },
    // The page H1. Replaces titlePart1 + titlePart2, which are kept only so older saves can
    // still be read (joined) until the admin saves the page again.
    title: { type: String, default: "BLOGS & NEWS" },
    titlePart1: { type: String },
    titlePart2: { type: String },
    subtitle: { type: String, default: "Insights. Innovation. Impact." },
    description: {
      type: String,
      default:
        "Stay updated with the latest trends, expert perspectives, innovations and success stories shaping India's organic food, agriculture and sustainable products industry.",
    },
    image: { type: String, default: DEFAULT_BLOG_HERO_BG }, // background image
    imageAlt: { type: String, default: "Bharat Organic Expo Blog Banner" },
    secondaryImage: { type: String },
  },
  { timestamps: true }
);

export default mongoose.model<IBlogHero>("BlogHero", BlogHeroSchema);
