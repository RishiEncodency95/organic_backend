import mongoose, { Schema } from "mongoose";

const wayToConnectSchema = new Schema(
  {
    img: { type: String, default: "" },
    title: { type: String, default: "" },
    contact: { type: String, default: "" },
    contactHref: { type: String, default: "" },
    descLine1: { type: String, default: "" },
    descLine2: { type: String, default: "" },
  },
  { _id: false }
);

const relationshipStatSchema = new Schema(
  {
    img: { type: String, default: "" },
    line1: { type: String, default: "" },
    line2: { type: String, default: "" },
  },
  { _id: false }
);

const whyVisitSupportSchema = new Schema(
  {
    title: { type: String, default: "NEED HELP?" },
    subtitle: { type: String, default: "WE’RE HERE TO SUPPORT YOU" },
    descLine1: { type: String, default: "Our dedicated team is ready to assist you at every step" },
    descLine2: { type: String, default: "of your PMS application journey." },
    commitmentTitle: { type: String, default: "OUR COMMITMENT" },
    commitmentLine1: { type: String, default: "Transparent guidance. Timely support." },
    commitmentLine2: { type: String, default: "Stronger together for a sustainable future." },
    waysToConnect: {
      type: [wayToConnectSchema],
      default: [
        {
          img: "",
          title: "EMAIL US",
          contact: "info@namogangewellness.com",
          contactHref: "mailto:info@namogangewellness.com",
          descLine1: "We typically reply",
          descLine2: "within 24 hours.",
        },
        {
          img: "",
          title: "CALL US",
          contact: "+91-9654900525",
          contactHref: "",
          descLine1: "Mon – Sat",
          descLine2: "10:00 AM – 6:00 PM",
        },
        {
          img: "",
          title: "WHATSAPP",
          contact: "+91-9654900525",
          contactHref: "",
          descLine1: "Quick responses during working hours.",
          descLine2: "",
        },
        {
          img: "",
          title: "VISIT WEBSITE",
          contact: "www.bharatorganicexpo.com",
          contactHref: "https://bharatorganicexpo.com/",
          descLine1: "Explore PMS details, guidelines & more.",
          descLine2: "",
        },
      ],
    },
    whyReachOut: {
      type: [String],
      default: [
        "Clarify PMS scheme guidelines & eligibility",
        "Get help with document preparation",
        "Understand the application & reimbursement process",
        "Track your application status",
        "Resolve any issues or queries quickly",
      ],
    },
    relationshipManagersTitle: { type: String, default: "DEDICATED RELATIONSHIP MANAGERS" },
    relationshipManagersDescLine1: { type: String, default: "Personalised assistance from start to finish." },
    relationshipManagersDescLine2: { type: String, default: "Your success is our priority." },
    relationshipManagersStats: {
      type: [relationshipStatSchema],
      default: [
        { img: "", line1: "TRUSTED", line2: "SUPPORT" },
        { img: "", line1: "EXPERT", line2: "GUIDANCE" },
        { img: "", line1: "TIMELY", line2: "ASSISTANCE" },
        { img: "", line1: "BETTER", line2: "OUTCOMES" },
      ],
    },
    bottomGreenTitle: { type: String, default: "TOGETHER, LET’S GROW A SUSTAINABLE INDIA" },
    bottomGreenDesc: { type: String, default: "We look forward to supporting your journey at " },
    bottomGreenHighlight: { type: String, default: "Bharat Organic Expo 2027." },
    bottomLightTitle: { type: String, default: "READY TO MOVE AHEAD?" },
    bottomLightDesc: {
      type: String,
      default: "Start your PMS application today and unlock government support for your growth.",
    },
    bottomLightCtaText: { type: String, default: "START YOUR APPLICATION" },
    bottomLightCtaHref: { type: String, default: "/registration/book-a-stand" },
  },
  { timestamps: true }
);

const WhyVisitSupport = mongoose.model("OrganicWhyVisitSupport", whyVisitSupportSchema);
export default WhyVisitSupport;
