import mongoose, { Schema } from "mongoose";

const benefitItemSchema = new Schema(
  {
    iconKey: { type: String, default: "" },
    title: { type: String, default: "" },
  },
  { _id: false }
);

const deliverableItemSchema = new Schema(
  {
    iconKey: { type: String, default: "" },
    title: { type: String, default: "" },
    desc: { type: String, default: "" },
  },
  { _id: false }
);

const categoryPrintingBrandingSchema = new Schema(
  {
    categoryName: { type: String, default: "Printing & Branding Partner" },
    hero: {
      titleLine1: { type: String, default: "PRINTING & BRANDING" },
      titleLine2: { type: String, default: "PARTNER" },
      subtitle: { type: String, default: "Print Perfection. Brand Prominence." },
      descriptionLine1: { type: String, default: "Partner with Bharat Organic Expo 2027 as our Printing & Branding Partner" },
      descriptionLine2: { type: String, default: "and supply high-quality signage, banners, print collaterals & branding services" },
      descriptionLine3: { type: String, default: "for exhibitors and organizers during the flagship expo." },
      date: { type: String, default: "19-21 February 2027" },
      location: { type: String, default: "Pragati Maidan, New Delhi" },
    },
    keyBenefitsHeading: { type: String, default: "KEY BENEFITS OF PARTNERING" },
    keyBenefits: {
      type: [benefitItemSchema],
      default: [
        { iconKey: "p1og", title: "Featured as Official\nPrinting & Branding Partner" },
        { iconKey: "p2og", title: "Access to Exhibitors\n& Venue Branding Needs" },
        { iconKey: "p3og", title: "High Brand Exposure\nAcross All Platforms" },
        { iconKey: "p4og", title: "Long-term Collaboration\nOpportunities" },
        { iconKey: "p5og", title: "Enhance Brand\nCredibility" },
        { iconKey: "p7og", title: "Preferred Choice for\nPrint & Media Solutions" },
      ],
    },
    deliverablesHeading: { type: String, default: "PARTNER DELIVERABLES" },
    deliverables: {
      type: [deliverableItemSchema],
      default: [
        { iconKey: "Globe", title: "Logo on official printing partner section on website", desc: "Your logo will be displayed on the partner page with direct link to your website." },
        { iconKey: "LayoutGrid", title: "Logo on signage & at venue (high visibility)", desc: "Prominent logo placement on directional signage, welcome boards & key areas." },
        { iconKey: "FileText", title: "Brand mention on event collateral (digital)", desc: "Your brand will be highlighted on banners, e-invites, social media creatives & more." },
        { iconKey: "Mic", title: "Acknowledgement during inaugural & valedictory sessions", desc: "Special recognition from the stage as our valued partner." },
        { iconKey: "BookOpen", title: "Name in partner directory (digital & print)", desc: "Your firm profile will be listed in the official partner directory." },
        { iconKey: "Ticket", title: "Complimentary Delegate Passes", desc: "Receive delegate passes for your team to network and connect during the event." },
        { iconKey: "Mail", title: "Logo in event emails & newsletters", desc: "Your brand will be featured in promotional emails sent to our subscriber database." },
        { iconKey: "MapPin", title: "Brochure / Advertisement in e-brochure", desc: "Your advertisement / printing catalog will be displayed in the official event e-brochure." },
        { iconKey: "Share2", title: "Social media shoutouts & tag mentions", desc: "Your print services will be promoted across our social media platforms with dedicated posts." },
        { iconKey: "Printer", title: "Showcase your print & branding solutions", desc: "Opportunity to showcase your signage, lanyard, banner & printing capabilities." },
        { iconKey: "HeartHandshake", title: "Co-branding on key communications", desc: "Your logo will be included in select event communications as our printing partner." },
        { iconKey: "Star", title: "Opportunity for joint campaigns & promotions", desc: "Collaborate with us on special offers to assist exhibitors with marketing collateral." },
      ],
    },
    whyPartner: {
      leftTitleLine1: { type: String, default: "WHY PARTNER AS" },
      leftTitleLine2: { type: String, default: "PRINTING & BRANDING PARTNER?" },
      formTitle: { type: String, default: "PARTNER WITH US" },
      formSubtitle: { type: String, default: "Fill in your details and our team will connect with you shortly." },
      contactEmail: { type: String, default: "info@namogangewellness.com" },
      contactPhone: { type: String, default: "+91-9654900525" },
      contactWebsite: { type: String, default: "bharatorganicexpo.com" },
      contactWebsiteUrl: { type: String, default: "https://bharatorganicexpo.com/" },
      contactLocationLine1: { type: String, default: "Pragati Maidan," },
      contactLocationLine2: { type: String, default: "New Delhi, India" },
      points: {
        type: [String],
        default: [
          "Position your agency as the official print partner for India's leading organic expo",
          "Gain direct contracts from 200+ exhibitors for banners, brochures & lanyards",
          "Build long-term corporate & event branding relationships",
          "Demonstrate premium print quality & eco-friendly printing capabilities",
          "Increase brand visibility & recall across all event platforms",
          "Deliver high-impact visual branding across venue entrance & stage backdrop",
        ],
      },
    },
  },
  { timestamps: true }
);

const CategoryPrintingBranding = mongoose.model(
  "OrganicCategoryPrintingBranding",
  categoryPrintingBrandingSchema
);

export default CategoryPrintingBranding;
