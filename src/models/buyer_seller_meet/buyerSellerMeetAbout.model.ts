import mongoose, { Schema } from "mongoose";

const linkItemSchema = new Schema(
  {
    label: { type: String, default: "" },
    icon: { type: String, default: "" },
    href: { type: String, default: "" },
    target: { type: String, default: "" },
  },
  { _id: false }
);

const buyerSellerMeetAboutSchema = new Schema(
  {
    heading: { type: String, default: "ABOUT BUYER-SELLER MEET" },
    paragraph1: {
      type: String,
      default:
        "The Buyer-Seller Meet at Bharat Organic Expo 2027 is designed to facilitate focused B2B interactions between participating exhibitors and relevant business buyers.",
    },
    paragraph2: { type: String, default: "The platform enables participants to explore:" },
    points: {
      type: [String],
      default: [
        "Sourcing & Distribution",
        "Institutional Supply",
        "Procurement & Private Label",
        "Strategic Partnerships",
        "Export-Import Opportunities",
        "Business Collaborations",
      ],
    },
    links: {
      type: [linkItemSchema],
      default: [
        { label: "Register as Buyer", icon: "User", href: "/registration/buyer-registration", target: "_blank" },
        { label: "Participate as Exhibitor", icon: "Briefcase", href: "/participate_as_exhibiture", target: "_blank" },
        { label: "How it Works", icon: "HelpCircle", href: "#how-it-works", target: "" },
        { label: "Who Can Participate", icon: "Users", href: "#who-can-participate", target: "" },
        { label: "Contact Us", icon: "Phone", href: "/contact", target: "_blank" },
      ],
    },
  },
  { timestamps: true }
);

const BuyerSellerMeetAbout = mongoose.model(
  "OrganicBuyerSellerMeetAbout",
  buyerSellerMeetAboutSchema
);

export default BuyerSellerMeetAbout;
