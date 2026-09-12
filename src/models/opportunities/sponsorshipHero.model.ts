import mongoose, { Schema } from "mongoose";

const statItemSchema = new Schema(
  {
    iconKey: { type: String, default: "" },
    number: { type: String, default: "" },
    label: { type: String, default: "" },
  },
  { _id: false }
);

const sponsorshipHeroSchema = new Schema(
  {
    titleLine1: { type: String, default: "SPONSORSHIP" },
    titleHighlight: { type: String, default: "OPPORTUNITIES" },
    badgeText: { type: String, default: "Partner. Promote. Make an Impact." },
    descriptionBold: { type: String, default: "Align your brand with India's Premier Organic Expo" },
    descriptionText: {
      type: String,
      default: "and connect with the right audience, build credibility and drive real impact.",
    },
    stats: {
      type: [statItemSchema],
      default: [
        { iconKey: "Users", number: "8,000+", label: "BUSINESS\nVISITORS" },
        { iconKey: "Store", number: "200+", label: "EXHIBITORS" },
        { iconKey: "Presentation", number: "150+", label: "SPEAKERS" },
        { iconKey: "Globe", number: "25+", label: "COUNTRIES" },
        { iconKey: "Handshake", number: "UNLIMITED", label: "BUSINESS\nOPPORTUNITIES" },
      ],
    },
  },
  { timestamps: true }
);

const SponsorshipHero = mongoose.model(
  "OrganicSponsorshipHero",
  sponsorshipHeroSchema
);

export default SponsorshipHero;
