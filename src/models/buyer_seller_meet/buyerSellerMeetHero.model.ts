import mongoose, { Schema } from "mongoose";

const buyerSellerMeetHeroSchema = new Schema(
  {
    titleLine1: { type: String, default: "BUYER-SELLER" },
    titleLine2: { type: String, default: "MEET 2027" },
    subtitle: {
      type: String,
      default:
        "Connect with the Right Businesses. Create Real Opportunities. A focused B2B networking platform at Bharat Organic Expo 2027.",
    },
    dates: { type: String, default: "19-21 February 2027" },
    venue: { type: String, default: "Hall 12, Bharat Mandapam, New Delhi" },
    buyerButtonLabel: { type: String, default: "REGISTER AS A BUYER" },
    buyerButtonHref: { type: String, default: "/registration/buyer-registration" },
    exhibitorButtonLabel: { type: String, default: "PARTICIPATE AS AN EXHIBITOR" },
    exhibitorButtonHref: { type: String, default: "/participate_as_exhibiture" },
  },
  { timestamps: true }
);

const BuyerSellerMeetHero = mongoose.model(
  "OrganicBuyerSellerMeetHero",
  buyerSellerMeetHeroSchema
);

export default BuyerSellerMeetHero;
