import mongoose, { Schema } from "mongoose";

const statItemSchema = new Schema(
  {
    iconKey: { type: String, default: "" },
    value: { type: String, default: "" },
    label: { type: String, default: "" },
  },
  { _id: false }
);

const partnershipHeroSchema = new Schema(
  {
    badgeText: { type: String, default: "PARTNERSHIP / COLLABORATION" },
    titleLine1: { type: String, default: "Let's Grow" },
    titleLine2: { type: String, default: "Organic." },
    titleLine3: { type: String, default: "Together." },
    subtitle: {
      type: String,
      default:
        "Partner with Bharat Organic Expo 2027 and be a part of India's leading platform for organic business, innovation, wellness and sustainability.",
    },
    dates: { type: String, default: "19 – 21 February 2027" },
    location: { type: String, default: "Bharat Mandapam, New Delhi" },
    stats: {
      type: [statItemSchema],
      default: [
        { iconKey: "Users", value: "8,000+", label: "VISITORS / DELEGATES" },
        { iconKey: "Store", value: "200+", label: "EXHIBITORS" },
        { iconKey: "Globe", value: "1,000+", label: "GLOBAL BUYERS" },
        { iconKey: "UserCheck", value: "65+", label: "EXPERT SPEAKERS" },
        { iconKey: "Briefcase", value: "B2B", label: "MEETINGS" },
      ],
    },
  },
  { timestamps: true }
);

const PartnershipHero = mongoose.model(
  "OrganicPartnershipHero",
  partnershipHeroSchema
);

export default PartnershipHero;
