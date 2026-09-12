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

const categoryTravelSchema = new Schema(
  {
    categoryName: { type: String, default: "Travel Partner" },
    hero: {
      titleLine1: { type: String, default: "TRAVEL" },
      titleLine2: { type: String, default: "PARTNER" },
      subtitle: { type: String, default: "Travel Seamless. Partner Stronger." },
      descriptionLine1: { type: String, default: "Partner with Bharat Organic Expo 2027 as our Travel Partner" },
      descriptionLine2: { type: String, default: "and provide end-to-end travel, flight booking, shuttle & local transport solutions" },
      descriptionLine3: { type: String, default: "for delegates, exhibitors and visitors attending from India and abroad." },
      date: { type: String, default: "19-21 February 2027" },
      location: { type: String, default: "Pragati Maidan, New Delhi" },
    },
    keyBenefitsHeading: { type: String, default: "KEY BENEFITS OF PARTNERING" },
    keyBenefits: {
      type: [benefitItemSchema],
      default: [
        { iconKey: "p1og", title: "Featured as Official\nTravel Partner" },
        { iconKey: "p2og", title: "Access to Global Exhibitors\n& Delegates" },
        { iconKey: "p3og", title: "High Brand Exposure\nAcross All Platforms" },
        { iconKey: "p4og", title: "Long-term Collaboration\nOpportunities" },
        { iconKey: "p5og", title: "Enhance Brand\nCredibility" },
        { iconKey: "p7og", title: "Preferred Choice for\nEvent Travel & Shuttles" },
      ],
    },
    deliverablesHeading: { type: String, default: "PARTNER DELIVERABLES" },
    deliverables: {
      type: [deliverableItemSchema],
      default: [
        { iconKey: "Globe", title: "Logo on official travel partner section on website", desc: "Your logo will be displayed on the partner page with direct link to your website." },
        { iconKey: "LayoutGrid", title: "Logo on signage & at venue (high visibility)", desc: "Prominent logo placement on directional signage, welcome boards & key areas." },
        { iconKey: "FileText", title: "Brand mention on event collateral (digital)", desc: "Your brand will be highlighted on banners, e-invites, social media creatives & more." },
        { iconKey: "Mic", title: "Acknowledgement during inaugural & valedictory sessions", desc: "Special recognition from the stage as our valued partner." },
        { iconKey: "BookOpen", title: "Name in partner directory (digital & print)", desc: "Your agency profile will be listed in the official partner directory." },
        { iconKey: "Ticket", title: "Complimentary Delegate Passes", desc: "Receive delegate passes for your team to network and connect during the event." },
        { iconKey: "Mail", title: "Logo in event emails & newsletters", desc: "Your brand will be featured in promotional emails sent to our subscriber database." },
        { iconKey: "MapPin", title: "Brochure / Advertisement in e-brochure", desc: "Your advertisement / travel catalog will be displayed in the official event e-brochure." },
        { iconKey: "Share2", title: "Social media shoutouts & tag mentions", desc: "Your travel agency will be promoted across our social media platforms with dedicated posts." },
        { iconKey: "Plane", title: "Showcase your travel & transport packages", desc: "Opportunity to showcase flight, cab & local tour packages to attendees." },
        { iconKey: "HeartHandshake", title: "Co-branding on key communications", desc: "Your logo will be included in select event communications as our travel partner." },
        { iconKey: "Star", title: "Opportunity for joint campaigns & promotions", desc: "Collaborate with us on special travel offers for delegates and international buyers." },
      ],
    },
    whyPartner: {
      leftTitleLine1: { type: String, default: "WHY PARTNER AS" },
      leftTitleLine2: { type: String, default: "TRAVEL PARTNER?" },
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
          "Position your agency as the official travel partner for India's premier organic expo",
          "Gain direct bookings from 8,000+ delegates, exhibitors & international buyers",
          "Offer flight, cab, bus & airport transfer packages to delegates",
          "Build long-term corporate & MICE travel partnerships",
          "Increase brand visibility & recall across all event platforms",
          "Enhance delegate travel convenience with customized packages",
        ],
      },
    },
  },
  { timestamps: true }
);

const CategoryTravel = mongoose.model(
  "OrganicCategoryTravel",
  categoryTravelSchema
);

export default CategoryTravel;
