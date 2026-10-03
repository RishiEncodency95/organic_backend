import mongoose, { Schema } from "mongoose";

// Defaults mirror the text the website showed before this was editable.
export const DEFAULT_NOMINATE_HERO_BG =
  "https://res.cloudinary.com/ldlcnnhz/image/upload/v1791009918/bharat-organic/nominate-advisory/hero-bg.webp";

const featureSchema = new Schema(
  {
    label: { type: String, default: "" }, // e.g. "Expertise"
    icon: { type: String, default: "" }, // lucide icon name, e.g. "Users"
  },
  { _id: false }
);

const nominateAdvisoryHeroSchema = new Schema(
  {
    enabled: { type: Boolean, default: true },
    eyebrow: { type: String, default: "JOIN OUR LEADERSHIP COUNCIL" },
    title: { type: String, default: "Nominate an Advisory Board Member" }, // the page H1
    description: {
      type: String,
      default: "Recognize leaders who can guide, support and strengthen the vision of Bharat Organic Expo.",
    },
    features: {
      type: [featureSchema],
      default: [
        { label: "Expertise", icon: "Users" },
        { label: "Vision", icon: "Lightbulb" },
        { label: "Collaboration", icon: "Handshake" },
        { label: "Global Impact", icon: "Globe" },
      ],
    },
    image: { type: String, default: DEFAULT_NOMINATE_HERO_BG }, // background image
    imageAlt: { type: String, default: "Nominate Advisory Board Member" },
  },
  { timestamps: true }
);

const NominateAdvisoryHero = mongoose.model("OrganicNominateAdvisoryHero", nominateAdvisoryHeroSchema);

export default NominateAdvisoryHero;
