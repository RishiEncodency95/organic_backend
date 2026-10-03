import mongoose, { Schema } from "mongoose";

// Defaults mirror the text the /exhibitors page showed before this was editable.
export const DEFAULT_EXHIBITORS_HERO_BG =
  "https://res.cloudinary.com/ldlcnnhz/image/upload/v1791010810/bharat-organic/exhibitors/hero-bg.webp";

const exhibitorsHeroSchema = new Schema(
  {
    enabled: { type: Boolean, default: true },
    eyebrow: { type: String, default: "TRUSTED BY" },
    title: { type: String, default: "150+ Leading Health & Wellness Brands" }, // the page H1
    description: {
      type: String,
      default:
        "India's most influential health, Ayurveda, fitness and wellness companies have chosen Bharat Organic Expo as the platform to showcase, connect and grow.",
    },
    date: { type: String, default: "19-21 February 2027" },
    location: { type: String, default: "Hall 12, Bharat Mandapam, New Delhi" },
    buttonLabel: { type: String, default: "REGISTER AS A BUYER" },
    buttonHref: { type: String, default: "/registration/buyer-registration" },
    secondaryButtonLabel: { type: String, default: "PARTICIPATE AS AN EXHIBITOR" },
    secondaryButtonHref: { type: String, default: "/registration/book-a-stand" },
    image: { type: String, default: DEFAULT_EXHIBITORS_HERO_BG }, // background image
    imageAlt: { type: String, default: "Bharat Organic Expo exhibitors" },
  },
  { timestamps: true }
);

const ExhibitorsHero = mongoose.model("OrganicExhibitorsHero", exhibitorsHeroSchema);

export default ExhibitorsHero;
