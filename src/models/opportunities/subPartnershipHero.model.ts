import mongoose, { Schema } from "mongoose";

// Hero of each /partnership/<slug> page (hotel-stay-partner, travel-partner, ...).
// One document per page, looked up by `slug`.
const subPartnershipHeroSchema = new Schema(
  {
    slug: { type: String, required: true, unique: true, trim: true },
    title: { type: String, default: "" }, // the page H1
    subtitle: { type: String, default: "" }, // short tagline under the H1
    description: { type: String, default: "" },
    date: { type: String, default: "19-21 February 2027" },
    location: { type: String, default: "Pragati Maidan, New Delhi" },
    image: { type: String, default: "" }, // background image
    imageAlt: { type: String, default: "" },
  },
  { timestamps: true }
);

const SubPartnershipHero = mongoose.model("OrganicSubPartnershipHero", subPartnershipHeroSchema);

export default SubPartnershipHero;
