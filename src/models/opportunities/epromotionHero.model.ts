import mongoose, { Schema } from "mongoose";

const statItemSchema = new Schema(
  {
    iconKey: { type: String, default: "" },
    number: { type: String, default: "" },
    label: { type: String, default: "" },
  },
  { _id: false }
);

const epromotionHeroSchema = new Schema(
  {
    titleLine1: { type: String, default: "E-PROMOTION" },
    titleHighlight: { type: String, default: "OPPORTUNITIES" },
    badgeText: { type: String, default: "Promote. Engage. Inspire." },
    descriptionBold: { type: String, default: "Maximize your brand visibility and" },
    descriptionText: {
      type: String,
      default: "connect with a highly targeted audience before, during and after the event.",
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
    image: { type: String, default: "https://res.cloudinary.com/ldlcnnhz/image/upload/v1791015124/bharat-organic/e-promotion/hero-bg.webp" }, // background image
    imageAlt: { type: String, default: "E-Promotion opportunities at Bharat Organic Expo 2027" },
  },
  { timestamps: true }
);

const EPromotionHero = mongoose.model(
  "OrganicEPromotionHero",
  epromotionHeroSchema
);

export default EPromotionHero;
