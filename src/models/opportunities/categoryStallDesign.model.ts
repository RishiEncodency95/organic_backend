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

const categoryStallDesignSchema = new Schema(
  {
    categoryName: { type: String, default: "Stall Design Partner" },
    hero: {
      titleLine1: { type: String, default: "STALL DESIGN &" },
      titleLine2: { type: String, default: "FABRICATION PARTNER" },
      subtitle: { type: String, default: "Design Smart. Build Stronger." },
      descriptionLine1: { type: String, default: "Partner with Bharat Organic Expo 2027 as our Stall Design & Fabrication Partner" },
      descriptionLine2: { type: String, default: "and deliver creative, customized booth designs and quality construction" },
      descriptionLine3: { type: String, default: "for leading brands and exhibitors at the expo." },
      date: { type: String, default: "19-21 February 2027" },
      location: { type: String, default: "Pragati Maidan, New Delhi" },
    },
    keyBenefitsHeading: { type: String, default: "KEY BENEFITS OF PARTNERING" },
    keyBenefits: {
      type: [benefitItemSchema],
      default: [
        { iconKey: "p1og", title: "Featured as Official\nStall Design Partner" },
        { iconKey: "p2og", title: "Access to Exhibitors\n& Booth Fabrication Needs" },
        { iconKey: "p3og", title: "High Brand Exposure\nAcross All Platforms" },
        { iconKey: "p4og", title: "Long-term Collaboration\nOpportunities" },
        { iconKey: "p5og", title: "Enhance Brand\nCredibility" },
        { iconKey: "p7og", title: "Preferred Choice for\nExhibition Booths" },
      ],
    },
    deliverablesHeading: { type: String, default: "PARTNER DELIVERABLES" },
    deliverables: {
      type: [deliverableItemSchema],
      default: [
        { iconKey: "Globe", title: "Logo on official stall design partner section on website", desc: "Your logo will be displayed on the partner page with direct link to your website." },
        { iconKey: "LayoutGrid", title: "Logo on signage & at venue (high visibility)", desc: "Prominent logo placement on directional signage, welcome boards & key areas." },
        { iconKey: "FileText", title: "Brand mention on event collateral (digital)", desc: "Your brand will be highlighted on banners, e-invites, social media creatives & more." },
        { iconKey: "Mic", title: "Acknowledgement during inaugural & valedictory sessions", desc: "Special recognition from the stage as our valued partner." },
        { iconKey: "BookOpen", title: "Name in partner directory (digital & print)", desc: "Your design studio profile will be listed in the official partner directory." },
        { iconKey: "Ticket", title: "Complimentary Delegate Passes", desc: "Receive delegate passes for your team to network and connect during the event." },
        { iconKey: "Mail", title: "Logo in event emails & newsletters", desc: "Your brand will be featured in promotional emails sent to our subscriber database." },
        { iconKey: "MapPin", title: "Brochure / Advertisement in e-brochure", desc: "Your advertisement / portfolio catalog will be displayed in the official event e-brochure." },
        { iconKey: "Share2", title: "Social media shoutouts & tag mentions", desc: "Your design services will be promoted across our social media platforms with dedicated posts." },
        { iconKey: "Hammer", title: "Showcase your stall designs & fabrication", desc: "Opportunity to showcase 3D booth renders, modular designs & fabrication work." },
        { iconKey: "HeartHandshake", title: "Co-branding on key communications", desc: "Your logo will be included in select event communications as our stall design partner." },
        { iconKey: "Star", title: "Opportunity for joint campaigns & promotions", desc: "Collaborate with us on special packages to assist exhibitors with booth construction." },
      ],
    },
    whyPartner: {
      leftTitleLine1: { type: String, default: "WHY PARTNER AS" },
      leftTitleLine2: { type: String, default: "STALL DESIGN PARTNER?" },
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
          "Position your studio as the official booth design & fabrication partner",
          "Gain direct contracts from 200+ exhibitors for customized stall construction",
          "Showcase innovative eco-friendly booth designs to top organic brands",
          "Build long-term contracts & annual trade show partnerships",
          "Increase brand visibility & recall across all event platforms",
          "Demonstrate turnkey booth setup, lighting & fabrication expertise",
        ],
      },
    },
  },
  { timestamps: true }
);

const CategoryStallDesign = mongoose.model(
  "OrganicCategoryStallDesign",
  categoryStallDesignSchema
);

export default CategoryStallDesign;
