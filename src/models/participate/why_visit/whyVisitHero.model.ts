import mongoose, { Schema } from "mongoose";

const buttonSchema = new Schema(
  {
    text: { type: String, default: "" },
    href: { type: String, default: "" },
    styleType: { type: String, default: "blue" },
  },
  { _id: false }
);

const statSchema = new Schema(
  {
    val: { type: String, default: "" },
    label: { type: String, default: "" },
  },
  { _id: false }
);

const whyVisitHeroSchema = new Schema(
  {
    tagline: { type: String, default: "WHY VISIT BHARAT ORGANIC EXPO 2027" },
    headlineLine1: { type: String, default: "Source Better." },
    headlineLine2: { type: String, default: "Connect Directly." },
    headlineLine3: { type: String, default: "Grow Your Business." },
    description: {
      type: String,
      default:
        "Discover new products, meet manufacturers and suppliers, explore sourcing opportunities and build valuable business connections across India's growing organic, natural and sustainable ecosystem.",
    },
    buttons: {
      type: [buttonSchema],
      default: [
        { text: "REGISTER AS A BUYER", href: "/registration/buyer-registration", styleType: "blue" },
        { text: "REGISTER AS A VISITOR", href: "/registration/visitor-registration", styleType: "orange" },
      ],
    },
    stats: {
      type: [statSchema],
      default: [
        { val: "8,000+", label: "VISITORS / DELEGATES" },
        { val: "200+", label: "EXHIBITORS" },
        { val: "GLOBAL", label: "PERSPECTIVES" },
        { val: "100+", label: "EXPERT SPEAKERS" },
        { val: "B2B", label: "MEETINGS" },
      ],
    },
  },
  { timestamps: true }
);

const WhyVisitHero = mongoose.model("OrganicWhyVisitHero", whyVisitHeroSchema);
export default WhyVisitHero;
