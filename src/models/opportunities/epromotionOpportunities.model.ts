import mongoose, { Schema } from "mongoose";

const oppItemSchema = new Schema(
  {
    iconKey: { type: String, default: "" },
    title: { type: String, default: "" },
    desc: { type: String, default: "" },
    bullets: { type: [String], default: [] },
  },
  { _id: false }
);

const epromotionOpportunitiesSchema = new Schema(
  {
    heading: { type: String, default: "OUR E-PROMOTION OPPORTUNITIES" },
    customHeading: { type: String, default: "CUSTOM PACKAGES AVAILABLE" },
    customDesc: {
      type: String,
      default:
        "We offer customized e-promotion solutions tailored to your marketing goals and budget.",
    },
    customButtonText: { type: String, default: "LET'S PROMOTE TOGETHER" },
    customButtonHref: { type: String, default: "/contact" },
    opportunities: {
      type: [oppItemSchema],
      default: [
        {
          iconKey: "z1og",
          title: "EMAIL CAMPAIGN BANNER",
          desc: "Place your banner in our pre-show email campaigns sent to our database of industry professionals.",
          bullets: ["High open rates", "Direct brand exposure", "Clickable to your website"],
        },
        {
          iconKey: "z2og",
          title: "NEWSLETTER SPONSORSHIP",
          desc: "Feature your banner in our monthly newsletters.",
          bullets: ["Strong brand recall", "Targeted industry reach", "Multiple placements"],
        },
        {
          iconKey: "z3og",
          title: "WEBSITE BANNER ADVERTISING",
          desc: "Display your banner on our website across high traffic pages.",
          bullets: ["Prime visibility", "Multiple banner sizes", "Link to your website"],
        },
        {
          iconKey: "z4og",
          title: "SOCIAL MEDIA PROMOTION",
          desc: "Get featured across our social media platforms before, during & after the event.",
          bullets: ["Facebook, LinkedIn, Instagram,\nTwitter, YouTube", "High engagement", "Wide reach"],
        },
        {
          iconKey: "z5og",
          title: "SPONSOR EMAIL FOOTER/BANNER",
          desc: "Your banner in the footer section of important event emails.",
          bullets: ["Consistent brand visibility", "Cost-effective", "Wide exposure"],
        },
        {
          iconKey: "z6og",
          title: "DEDICATED EMAILER",
          desc: "Stand out with a dedicated emailer sent to our verified database.",
          bullets: ["100% brand focus", "High engagement", "Detailed presentation"],
        },
        {
          iconKey: "z7og",
          title: "DIGITAL PARTNERSHIP",
          desc: "Associate as our Digital Partner and get premium visibility across all digital channels.",
          bullets: ["Branding on all digital platforms", "Exclusive recognition", "Lead generation benefits"],
        },
        {
          iconKey: "z8og",
          title: "WEBINAR & VIRTUAL\nSESSION SPONSORSHIP",
          desc: "Sponsor pre-event webinars and virtual sessions.",
          bullets: ["Thought leadership", "Direct interaction", "Lead capture"],
        },
      ],
    },
  },
  { timestamps: true }
);

const EPromotionOpportunities = mongoose.model(
  "OrganicEPromotionOpportunities",
  epromotionOpportunitiesSchema
);

export default EPromotionOpportunities;
