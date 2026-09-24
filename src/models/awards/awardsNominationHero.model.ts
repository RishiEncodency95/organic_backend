import mongoose, { Schema } from "mongoose";

const awardsNominationHeroSchema = new Schema(
  {
    enabled: { type: Boolean, default: true },
    eyebrow: { type: String, default: "" },
    title: { type: String, default: "Bharat Organic Excellence Awards 2027" },
    titlePrefix: { type: String, default: "Bharat Organic" },
    titlePrimary: { type: String, default: "Excellence" },
    titleSecondary: { type: String, default: "Awards 2027" },
    subtitle: {
      type: String,
      default: "Celebrating Excellence • Innovation • Sustainability",
    },
    description: {
      type: String,
      default:
        "Honouring the changemakers, organizations and innovations during india's organic, natural and sustainable future.",
    },
    shortDescription: {
      type: String,
      default:
        "Honouring the changemakers, organizations and innovations during india's organic, natural and sustainable future.",
    },
    buttonLabel: { type: String, default: "Submit Nomination" },
    buttonHref: { type: String, default: "#nomination-form" },
    secondaryButtonLabel: { type: String, default: "View Categories" },
    secondaryButtonHref: { type: String, default: "/awards" },
    date: { type: String, default: "19 - 21 February 2027" },
    dateLine1: { type: String, default: "19 - 21" },
    dateLine2: { type: String, default: "February 2027" },
    location: {
      type: String,
      default: "Hall 12, Bharat Mandapam, PRAGATI MAIDAN, NEW DELHI, INDIA",
    },
    venueLine1: { type: String, default: "Hall 12, Bharat Mandapam" },
    venueLine2: { type: String, default: "PRAGATI MAIDAN, NEW DELHI, INDIA" },
    image: {
      type: String,
      default:
        "",
    },
    bgImage: {
      type: String,
      default:
        "",
    },
  },
  { timestamps: true }
);

const AwardsNominationHero = mongoose.model(
  "OrganicAwardsNominationHero",
  awardsNominationHeroSchema
);

export default AwardsNominationHero;
