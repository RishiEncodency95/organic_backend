import mongoose, { Schema } from "mongoose";

const highlightSchema = new Schema(
  {
    main: { type: String, default: "" },
    sub: { type: String, default: "" },
    img: { type: String, default: "" },
  },
  { _id: false }
);

const buttonSchema = new Schema(
  {
    label: { type: String, default: "" },
    href: { type: String, default: "" },
    variant: { type: String, default: "orange" },
  },
  { _id: false }
);

const quoteLineSchema = new Schema(
  {
    text: { type: String, default: "" },
    color: { type: String, default: "#1b5e20" },
  },
  { _id: false }
);

const eventCardSchema = new Schema(
  {
    dateRange: { type: String, default: "19 – 21" },
    monthYear: { type: String, default: "FEBRUARY 2027" },
    locationTitle: { type: String, default: "BHARAT MANDAPAM," },
    locationSub: { type: String, default: "NEW DELHI, INDIA" },
    quoteLines: {
      type: [quoteLineSchema],
      default: [
        { text: "A Global Convergence", color: "#1b5e20" },
        { text: "of Organic Trade &", color: "#4B1426" },
        { text: "Sustainable Business", color: "#1b5e20" },
      ],
    },
  },
  { _id: false }
);

const whyExhibitHeroSchema = new Schema(
  {
    tagline: { type: String, default: "INDIA'S PREMIER ORGANIC & WELLNESS EVENT" },
    titlePrefix: { type: String, default: "CONNECT. COLLABORATE." },
    titleHighlight: { type: String, default: "CULTIVATE A HEALTHIER TOMORROW." },
    description: {
      type: String,
      default:
        "Bharat Organic Expo brings together global innovators, brands, buyers & experts to promote sustainable living and natural well-being.",
    },
    bgImage: { type: String, default: "" },
    highlights: {
      type: [highlightSchema],
      default: [
        { main: "Global", sub: "Exposure", img: "" },
        { main: "Quality", sub: "Connections", img: "" },
        { main: "Business", sub: "Growth", img: "" },
        { main: "Brand", sub: "Visibility", img: "" },
      ],
    },
    buttons: {
      type: [buttonSchema],
      default: [
        { label: "Book Your Stall", href: "/registration/book-a-stand", variant: "orange" },
        { label: "Download Brochure", href: "/download/invited card.pdf", variant: "blue" },
      ],
    },
    eventCard: { type: eventCardSchema, default: () => ({}) },
  },
  { timestamps: true }
);

const WhyExhibitHero = mongoose.model("OrganicWhyExhibitHero", whyExhibitHeroSchema);
export default WhyExhibitHero;
