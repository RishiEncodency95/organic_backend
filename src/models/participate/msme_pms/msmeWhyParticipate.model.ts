import mongoose, { Schema } from "mongoose";

const featureCardSchema = new Schema(
  {
    title: { type: String, default: "" },
    description: { type: String, default: "" },
    icon: { type: String, default: "" },
  },
  { _id: false }
);

const msmeWhyParticipateSchema = new Schema(
  {
    eyebrow: { type: String, default: "WHY PARTICIPATE?" },
    title: { type: String, default: "Key Benefits for MSMEs at Bharat Organic Expo 2027" },
    subtitle: {
      type: String,
      default:
        "Leverage government support to showcase your organic products, expand market reach and connect with key industry decision-makers.",
    },
    features: {
      type: [featureCardSchema],
      default: [
        {
          title: "Subsidized Cost",
          description: "Save up to 80%-100% on stall space rent with PMS Scheme reimbursement.",
          icon: "subsidizedCost",
        },
        {
          title: "National Exposure",
          description: "Exhibit alongside 500+ leading organic brands and 30,000+ targeted visitors.",
          icon: "nationalExposure",
        },
        {
          title: "B2B Matchmaking",
          description: "Participate in structured Buyer-Seller meets with pre-verified organic buyers.",
          icon: "b2bMatchmaking",
        },
        {
          title: "Brand Credibility",
          description: "Gain trust as a government-backed participant in India's flagship organic trade fair.",
          icon: "brandCredibility",
        },
      ],
    },
    ctaLabel: { type: String, default: "BOOK YOUR STALL NOW" },
    ctaHref: { type: String, default: "/registration/book-a-stand" },
  },
  { timestamps: true }
);

const MsmeWhyParticipate = mongoose.model(
  "OrganicMsmeWhyParticipate",
  msmeWhyParticipateSchema
);
export default MsmeWhyParticipate;
