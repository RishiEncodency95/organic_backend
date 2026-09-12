import mongoose, { Schema } from "mongoose";

const brandingItemSchema = new Schema(
  {
    iconKey: { type: String, default: "" },
    text: { type: String, default: "" },
  },
  { _id: false }
);

const impactItemSchema = new Schema(
  {
    iconKey: { type: String, default: "" },
    text: { type: String, default: "" },
  },
  { _id: false }
);

const sponsorshipBottomSchema = new Schema(
  {
    leftHeading: { type: String, default: "OTHER BRANDING OPPORTUNITIES" },
    otherBranding: {
      type: [brandingItemSchema],
      default: [
        { iconKey: "IdCard", text: "Lanyard Sponsor" },
        { iconKey: "Plug", text: "Charging Station Sponsor" },
        { iconKey: "Contact", text: "Badge Sponsor" },
        { iconKey: "Wifi", text: "Wi-Fi Sponsor" },
        { iconKey: "Briefcase", text: "Delegate Kit Sponsor" },
        { iconKey: "Mic", text: "Conference Session Sponsor" },
        { iconKey: "ShoppingBag", text: "Visitor Bag Sponsor" },
        { iconKey: "Trophy", text: "Award Sponsor" },
        { iconKey: "Coffee", text: "Refreshment Sponsor" },
        { iconKey: "MapPin", text: "Hall / Zone Sponsor" },
      ],
    },
    rightHeading: { type: String, default: "MAXIMIZE YOUR BRAND IMPACT" },
    rightSubtitle: { type: String, default: "Gain visibility across multiple platforms" },
    buttonText: { type: String, default: "LET'S CREATE IMPACT TOGETHER" },
    buttonHref: { type: String, default: "/contact" },
    maximizeImpact: {
      type: [impactItemSchema],
      default: [
        { iconKey: "Globe", text: "Event Website" },
        { iconKey: "Mail", text: "Email Campaigns" },
        { iconKey: "Share2", text: "Social Media" },
        { iconKey: "Building2", text: "On-site Branding" },
        { iconKey: "Newspaper", text: "Press Coverage" },
        { iconKey: "FileText", text: "Print & Digital Media" },
        { iconKey: "Presentation", text: "Signage & Hoardings" },
        { iconKey: "Megaphone", text: "Visitor Promotions" },
      ],
    },
  },
  { timestamps: true }
);

const SponsorshipBottom = mongoose.model(
  "OrganicSponsorshipBottom",
  sponsorshipBottomSchema
);

export default SponsorshipBottom;
