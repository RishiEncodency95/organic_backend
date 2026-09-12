import mongoose, { Schema } from "mongoose";

const connectMethodSchema = new Schema(
  {
    id: { type: String, default: "" },
    icon: { type: String, default: "" },
    title: { type: String, default: "" },
    detail: { type: String, default: "" },
    actionText: { type: String, default: "" },
    actionHref: { type: String, default: "" },
  },
  { _id: false }
);

const msmeNeedHelpSchema = new Schema(
  {
    tagline: { type: String, default: "NEED HELP WITH PMS SCHEME?" },
    title: { type: String, default: "WE ARE HERE TO ASSIST YOU" },
    connectMethods: {
      type: [connectMethodSchema],
      default: [
        {
          id: "phone",
          icon: "phone",
          title: "CALL US",
          detail: "+91 9654900525",
          actionText: "Call Now",
          actionHref: "tel:+919654900525",
        },
        {
          id: "email",
          icon: "email",
          title: "EMAIL US",
          detail: "msme@organicexpo.com",
          actionText: "Send Mail",
          actionHref: "mailto:msme@organicexpo.com",
        },
        {
          id: "whatsapp",
          icon: "whatsapp",
          title: "WHATSAPP",
          detail: "+91 9654900525",
          actionText: "Chat Now",
          actionHref: "https://wa.me/919654900525",
        },
        {
          id: "office",
          icon: "office",
          title: "VISIT OFFICE",
          detail: "New Delhi, India",
          actionText: "Get Directions",
          actionHref: "/contact",
        },
      ],
    },
    whyReachOutTitle: { type: String, default: "WHY REACH OUT TO US?" },
    whyReachOutItems: {
      type: [String],
      default: [
        "Guidance on PMS Scheme eligibility & document preparation",
        "Assistance with stall booking and space selection",
        "Dedicated PMS Relationship Manager for hassle-free processing",
        "Updates on government guidelines and reimbursement procedures",
      ],
    },
    relationshipTitle: { type: String, default: "DEDICATED RELATIONSHIP MANAGERS" },
    relationshipSub1: { type: String, default: "Personalised assistance from start to finish." },
    relationshipSub2: { type: String, default: "Your success is our priority." },
    footerTitle1: { type: String, default: "Together, Let's Grow" },
    footerTitle2: { type: String, default: "A Sustainable India" },
    footerSub1: { type: String, default: "We look forward to supporting your " },
    footerSubHighlight: { type: String, default: "Bharat Organic Expo 2027." },
    ctaHeading: { type: String, default: "Ready to Move Ahead?" },
    ctaSub: {
      type: String,
      default: "Start your PMS application today and unlock government support for your growth.",
    },
    ctaHref: { type: String, default: "/registration/book-a-stand" },
  },
  { timestamps: true }
);

const MsmeNeedHelp = mongoose.model("OrganicMsmeNeedHelp", msmeNeedHelpSchema);
export default MsmeNeedHelp;
