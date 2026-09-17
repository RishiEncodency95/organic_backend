import mongoose, { Schema } from "mongoose";

const awardsHeroSchema = new Schema(
  {
    enabled: { type: Boolean, default: true },
    eyebrow: { type: String, default: "BHARAT ORGANIC" },
    tagline: { type: String, default: "BHARAT ORGANIC" },
    title: { type: String, default: "EXCELLENCE AWARDS 2027" },
    titlePrimary: { type: String, default: "EXCELLENCE" },
    titleSecondary: { type: String, default: "AWARDS 2027" },
    subtitle: { type: String, default: "Celebrating Excellence • Innovation • Sustainability" },
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
    shortDescription: {
      type: String,
      default:
        "Honouring the changemakers, organisations and innovations driving India's organic, natural and sustainable future.",
    },
    date: { type: String, default: "19 - 21 February 2027" },
    dateLine1: { type: String, default: "19 - 21" },
    dateLine2: { type: String, default: "February 2027" },
    location: { type: String, default: "Hall 12, Bharat Mandapam, PRAGATI MAIDAN, NEW DELHI, INDIA" },
    venueLine1: { type: String, default: "Hall 12, Bharat Mandapam" },
    venueLine2: { type: String, default: "PRAGATI MAIDAN, NEW DELHI, INDIA" },
    image: { type: String, default: "https://res.cloudinary.com/dr8mld4i0/image/upload/v1788165233/moksha-sewa/assets/km.jpg" },
    buttonLabel: { type: String, default: "NOMINATE NOW" },
    buttonHref: { type: String, default: "/awards/nominations" },
    secondaryButtonLabel: { type: String, default: "VIEW CATEGORIES" },
    secondaryButtonHref: { type: String, default: "#categories" },
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
