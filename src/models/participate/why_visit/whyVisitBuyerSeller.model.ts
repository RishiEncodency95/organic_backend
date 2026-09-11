import mongoose, { Schema } from "mongoose";

const featureSchema = new Schema(
  {
    img: { type: String, default: "" },
    titleLine1: { type: String, default: "" },
    titleLine2: { type: String, default: "" },
    descLine1: { type: String, default: "" },
    descLine2: { type: String, default: "" },
    descLine3: { type: String, default: "" },
  },
  { _id: false }
);

const statSchema = new Schema(
  {
    val: { type: String, default: "" },
    label: { type: String, default: "" },
    subtext: { type: String, default: "" },
  },
  { _id: false }
);

const whyVisitBuyerSellerSchema = new Schema(
  {
    badge: { type: String, default: "REASON TO VISIT" },
    title: { type: String, default: "Buyer–Seller Meet" },
    subline: { type: String, default: "MEET. CONNECT. GROW." },
    descLine1: { type: String, default: "A focused platform to connect serious buyers with trusted " },
    descLine2: { type: String, default: "exhibitors and build long-term business relationships." },
    features: {
      type: [featureSchema],
      default: [
        {
          img: "",
          titleLine1: "Pre-scheduled",
          titleLine2: "Meetings",
          descLine1: "We connect you with",
          descLine2: "relevant exhibitors",
          descLine3: "before the expo.",
        },
        {
          img: "",
          titleLine1: "Quality",
          titleLine2: "Connections",
          descLine1: "Meet verified",
          descLine2: "manufacturers,",
          descLine3: "suppliers & brands.",
        },
        {
          img: "",
          titleLine1: "Save Time,",
          titleLine2: "Close Deals",
          descLine1: "One-to-one meetings",
          descLine2: "that help you discover,",
          descLine3: "compare & decide.",
        },
        {
          img: "",
          titleLine1: "Grow Your",
          titleLine2: "Business",
          descLine1: "Explore new products,",
          descLine2: "expand your portfolio",
          descLine3: "& increase margins.",
        },
      ],
    },
    ctaBtnText: { type: String, default: "REGISTER AS BUYER" },
    ctaBtnHref: { type: String, default: "/registration/buyer-registration" },
    ctaSubtextTop: { type: String, default: "Exclusive for" },
    ctaSubtextBottom: { type: String, default: "Serious Business Buyers" },
    stats: {
      type: [statSchema],
      default: [
        { val: "200+", label: "EXHIBITORS", subtext: "Across the Organic Ecosystem" },
        { val: "100+", label: "SPEAKERS", subtext: "Industry Leaders & Experts" },
        { val: "8,000+", label: "BUSINESS VISITORS", subtext: "Traders, Buyers, Retailers & More" },
        { val: "GLOBAL", label: "PARTICIPATION", subtext: "Connecting India with the World" },
      ],
    },
    bottomDate: { type: String, default: "19–21 FEBRUARY 2027" },
    bottomVenue: { type: String, default: "HALL 12, BHARAT MANDAPAM, NEW DELHI" },
    bottomCtaText: { type: String, default: "PLAN YOUR VISIT NOW" },
    bottomCtaHref: { type: String, default: "/registration/visitor-registration" },
  },
  { timestamps: true }
);

const WhyVisitBuyerSeller = mongoose.model("OrganicWhyVisitBuyerSeller", whyVisitBuyerSellerSchema);
export default WhyVisitBuyerSeller;
