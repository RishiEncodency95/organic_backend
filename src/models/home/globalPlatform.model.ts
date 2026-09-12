import mongoose, { Document, Schema } from "mongoose";

const cardSchema = new Schema({
  iconSrc: { type: String, default: "" },
  iconAlt: { type: String, default: "" },
  iconWidth: { type: Number, default: 90 },
  iconHeight: { type: Number, default: 90 },
  title: { type: String, default: "" },
  description: { type: String, default: "" },
  desc: { type: String, default: "" },
  bgClass: { type: String, default: "" },
  borderClass: { type: String, default: "" },
});

const globalPlatformSchema = new Schema(
  {
    enabled: { type: Boolean, default: true },
    eyebrow: { type: String, default: "FROM INDIA TO THE WORLD" },
    badge: { type: String, default: "FROM INDIA TO THE WORLD" },
    titlePrimary: { type: String, default: "From a National Expo to a" },
    titleSecondary: { type: String, default: "Global Platform" },
    description: {
      type: String,
      default:
        "Bharat Organic Expo is India's most influential platform connecting organic products, people and possibilities.",
    },
    keyPoint1: {
      type: String,
      default: "International Exhibitors & Global Brands",
    },
    keyPoint2: {
      type: String,
      default: "Buyers, Distributors & Importers",
    },
    keyPoint3: {
      type: String,
      default: "Research & Innovation | Startups",
    },
    keyPoint4: {
      type: String,
      default: "Investors, Financial Institutions",
    },
    keyPoint5: {
      type: String,
      default: "Government Bodies, Embassies & Policy Makers",
    },
    listItems: [{ type: String }],
    items: [cardSchema],
    cards: [cardSchema],
  },
  { timestamps: true }
);

const GlobalPlatform = mongoose.model(
  "OrganicGlobalPlatform",
  globalPlatformSchema
);
export default GlobalPlatform;
