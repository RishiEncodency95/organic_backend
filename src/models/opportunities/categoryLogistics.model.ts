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

const categoryLogisticsSchema = new Schema(
  {
    categoryName: { type: String, default: "Logistics Partner" },
    hero: {
      titleLine1: { type: String, default: "LOGISTICS" },
      titleLine2: { type: String, default: "PARTNER" },
      subtitle: { type: String, default: "Move Smart. Deliver Excellence." },
      descriptionLine1: { type: String, default: "Partner with Bharat Organic Expo 2027 as our Logistics Partner" },
      descriptionLine2: { type: String, default: "and provide seamless supply chain, transport & handling solutions for exhibitors" },
      descriptionLine3: { type: String, default: "and organizers from across India and abroad." },
      date: { type: String, default: "19-21 February 2027" },
      location: { type: String, default: "Pragati Maidan, New Delhi" },
    },
    keyBenefitsHeading: { type: String, default: "KEY BENEFITS OF PARTNERING" },
    keyBenefits: {
      type: [benefitItemSchema],
      default: [
        { iconKey: "p1og", title: "Featured as Official\nLogistics Partner" },
        { iconKey: "p2og", title: "Access to Exhibitors\n& International Delegates" },
        { iconKey: "p3og", title: "High Brand Exposure\nAcross All Platforms" },
        { iconKey: "p4og", title: "Long-term Collaboration\nOpportunities" },
        { iconKey: "p5og", title: "Enhance Brand\nCredibility" },
        { iconKey: "p7og", title: "Preferred Choice for\nEvent Logistics" },
      ],
    },
    deliverablesHeading: { type: String, default: "PARTNER DELIVERABLES" },
    deliverables: {
      type: [deliverableItemSchema],
      default: [
        { iconKey: "Globe", title: "Logo on official logistics partner section on website", desc: "Your logo will be displayed on the partner page with direct link to your website." },
        { iconKey: "LayoutGrid", title: "Logo on signage & at venue (high visibility)", desc: "Prominent logo placement on directional signage, welcome boards & key areas." },
        { iconKey: "FileText", title: "Brand mention on event collateral (digital)", desc: "Your brand will be highlighted on banners, e-invites, social media creatives & more." },
        { iconKey: "Mic", title: "Acknowledgement during inaugural & valedictory sessions", desc: "Special recognition from the stage as our valued partner." },
        { iconKey: "BookOpen", title: "Name in partner directory (digital & print)", desc: "Your company profile will be listed in the official partner directory." },
        { iconKey: "Ticket", title: "Complimentary Delegate Passes", desc: "Receive delegate passes for your team to network and connect during the event." },
        { iconKey: "Mail", title: "Logo in event emails & newsletters", desc: "Your brand will be featured in promotional emails sent to our subscriber database." },
        { iconKey: "MapPin", title: "Brochure / Advertisement in e-brochure", desc: "Your advertisement / service profile will be displayed in the official event e-brochure." },
        { iconKey: "Share2", title: "Social media shoutouts & tag mentions", desc: "Your logistics service will be promoted across our social media platforms with dedicated posts." },
        { iconKey: "Truck", title: "Showcase your logistics & transport services", desc: "Opportunity to showcase your transport, warehousing & handling solutions." },
        { iconKey: "HeartHandshake", title: "Co-branding on key communications", desc: "Your logo will be included in select event communications as our logistics partner." },
        { iconKey: "Star", title: "Opportunity for joint campaigns & promotions", desc: "Collaborate with us on special offers to assist exhibitors with cargo and freight." },
      ],
    },
    whyPartner: {
      leftTitleLine1: { type: String, default: "WHY PARTNER AS" },
      leftTitleLine2: { type: String, default: "LOGISTICS PARTNER?" },
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
          "Position your firm as the official logistics partner for top organic brands",
          "Gain direct contracts from 200+ exhibitors & international delegates",
          "Expand long-term logistics networks across domestic and global markets",
          "Build ongoing business partnerships beyond the 3-day expo",
          "Increase brand visibility & recall across all event platforms",
          "Demonstrate reliable freight handling & supply chain capabilities",
        ],
      },
    },
  },
  { timestamps: true }
);

const CategoryLogistics = mongoose.model(
  "OrganicCategoryLogistics",
  categoryLogisticsSchema
);

export default CategoryLogistics;
