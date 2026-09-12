import mongoose, { Schema } from "mongoose";

const segmentSchema = new Schema(
  {
    num: { type: String, default: "" },
    title: { type: String, default: "" },
    items: { type: String, default: "" },
    desc: { type: String, default: "" },
    color: { type: String, default: "#2d7a27" },
    iconImg: { type: String, default: "" },
    image: { type: String, default: "" },
  },
  { _id: false }
);

const whyVisitSegmentsSchema = new Schema(
  {
    badge: { type: String, default: "WHAT CAN YOU SOURCE?" },
    subline: { type: String, default: "ONE EXPO • COMPLETE ECOSYSTEM" },
    mainTitleLine1: { type: String, default: "Explore " },
    segmentCount: { type: String, default: "6" },
    mainTitleLine2: { type: String, default: " Major Industry Segments" },
    segments: {
      type: [segmentSchema],
      default: [
        {
          num: "01",
          title: "Organic Food & Nutrition",
          items: "Food • Beverages • Nutraceuticals",
          desc: "Certified organic pulses, grains, superfoods, organic tea/coffee, cold-pressed oils & health supplements.",
          color: "#2d7a27",
          iconImg: "",
          image: "",
        },
        {
          num: "02",
          title: "AYUSH, Herbal & Wellness",
          items: "Ayurveda • Herbal • Wellness",
          desc: "Ayurvedic formulations, herbal extracts, essential oils, wellness teas & traditional remedies.",
          color: "#0f808c",
          iconImg: "",
          image: "",
        },
        {
          num: "03",
          title: "Organic\nAgriculture",
          items: "Farming • Seeds • Bio-Inputs",
          desc: "Bio-fertilizers, organic pesticides, non-GMO seeds, farm machinery & organic soil enhancers.",
          color: "#5c821a",
          iconImg: "",
          image: "",
        },
        {
          num: "04",
          title: "Natural Living & Personal Care",
          items: "Beauty • Personal Care • Natural Lifestyle",
          desc: "Organic cosmetics, natural skincare, sustainable apparel, eco-friendly home care & hygiene products.",
          color: "#6b3b7a",
          iconImg: "",
          image: "",
        },
        {
          num: "05",
          title: "GreenTech & Sustainability",
          items: "AgriTech • Packaging • Processing",
          desc: "Biodegradable packaging, solar energy solutions, waste management & smart AgriTech innovations.",
          color: "#0e7b8a",
          iconImg: "",
          image: "",
        },
        {
          num: "06",
          title: "Trade, Certification & Global Business",
          items: "Certification • Export • Import • Business Services",
          desc: "Organic certification bodies, export-import agencies, testing labs & B2B logistics services.",
          color: "#d96b18",
          iconImg: "",
          image: "",
        },
      ],
    },
    ctaText: { type: String, default: "EXPLORE EXHIBITOR PROFILE" },
    ctaHref: { type: String, default: "/exhibitors" },
  },
  { timestamps: true }
);

const WhyVisitSegments = mongoose.model("OrganicWhyVisitSegments", whyVisitSegmentsSchema);
export default WhyVisitSegments;
