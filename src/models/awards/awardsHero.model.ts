import mongoose, { Schema } from "mongoose";

const awardsHeroSchema = new Schema(
  {
    enabled: { type: Boolean, default: true },
    tagline: { type: String, default: "BHARAT ORGANIC" },
    titlePrimary: { type: String, default: "EXCELLENCE" },
    titleSecondary: { type: String, default: "AWARDS 2027" },
    highlights: [
      {
        id: { type: Number },
        text: { type: String, default: "" },
      },
    ],
    description: {
      type: String,
      default:
        "Honouring the changemakers, organisations and innovations driving India's organic, natural and sustainable future.",
    },
    dateLine1: { type: String, default: "19 - 21" },
    dateLine2: { type: String, default: "February 2027" },
    venueLine1: { type: String, default: "Hall 12, Bharat Mandapam" },
    venueLine2: { type: String, default: "PRAGATI MAIDAN, NEW DELHI, INDIA" },
    buttons: [
      {
        id: { type: String, default: "" },
        label: { type: String, default: "" },
        href: { type: String, default: "" },
        target: { type: String, default: "" },
        rel: { type: String, default: "" },
        variant: { type: String, default: "primary" },
        icon: { type: String, default: "" },
      },
    ],
  },
  { timestamps: true }
);

const AwardsHero = mongoose.model("OrganicAwardsHero", awardsHeroSchema);
export default AwardsHero;
