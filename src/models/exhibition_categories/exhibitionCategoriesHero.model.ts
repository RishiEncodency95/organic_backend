import mongoose, { Schema } from "mongoose";

// Defaults mirror the text the website showed before this was editable.
export const DEFAULT_EXHIBITION_HERO_BG =
  "https://res.cloudinary.com/ldlcnnhz/image/upload/v1791006354/bharat-organic/exhibition-categories/hero-bg.webp";

const featureSchema = new Schema(
  {
    value: { type: String, default: "" }, // e.g. "200+"
    label: { type: String, default: "" }, // e.g. "Exhibitors Expected"
  },
  { _id: false }
);

const exhibitionCategoriesHeroSchema = new Schema(
  {
    enabled: { type: Boolean, default: true },
    title: { type: String, default: "EXHIBITION CATEGORIES" }, // the page H1
    subtitle: { type: String, default: "EXPLORE THE COMPLETE ORGANIC ECOSYSTEM" },
    description: {
      type: String,
      default:
        "From farm inputs and organic production to finished products, technology, certification and global trade—discover every opportunity to grow your business at Bharat Organic Expo 2027.",
    },
    features: {
      type: [featureSchema],
      default: [
        { value: "200+", label: "Exhibitors Expected" },
        { value: "8000+", label: "Business Visitors" },
        { value: "Global", label: "Business Platform" },
        { value: "Endless", label: "Business Opportunities" },
      ],
    },
    image: { type: String, default: DEFAULT_EXHIBITION_HERO_BG }, // background image
  },
  { timestamps: true }
);

const ExhibitionCategoriesHero = mongoose.model(
  "OrganicExhibitionCategoriesHero",
  exhibitionCategoriesHeroSchema
);

export default ExhibitionCategoriesHero;
