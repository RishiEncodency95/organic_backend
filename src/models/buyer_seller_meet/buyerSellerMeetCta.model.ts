import mongoose, { Schema } from "mongoose";

const buyerSellerMeetCtaSchema = new Schema(
  {
    headingLine1: { type: String, default: "READY TO CONNECT WITH" },
    headingHighlight: { type: String, default: "NEW BUSINESS OPPORTUNITIES?" },
    subtitle: {
      type: String,
      default: "Join the Buyer-Seller Meet at Bharat Organic Expo 2027.",
    },
    buyerButtonLabel: { type: String, default: "REGISTER AS A BUYER" },
    buyerButtonHref: { type: String, default: "/registration/buyer-registration" },
    exhibitorButtonLabel: { type: String, default: "PARTICIPATE AS AN EXHIBITOR" },
    exhibitorButtonHref: { type: String, default: "/participate_as_exhibiture" },
    helpText: {
      type: String,
      default: "Need Help? +91 96549 00525  |  info@namogangewellness.com",
    },
  },
  { timestamps: true }
);

const BuyerSellerMeetCta = mongoose.model(
  "OrganicBuyerSellerMeetCta",
  buyerSellerMeetCtaSchema
);

export default BuyerSellerMeetCta;
