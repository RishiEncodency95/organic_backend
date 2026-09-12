import mongoose, { Schema } from "mongoose";

const buyerSellerMeetWhyJoinSchema = new Schema(
  {
    buyerHeading: { type: String, default: "WHY JOIN THE BUYER-SELLER MEET?" },
    buyerTitle: { type: String, default: "For Buyers" },
    buyerPoints: {
      type: [String],
      default: [
        "Discover New Suppliers",
        "Compare Products & Solutions",
        "Explore New Brands",
        "Develop Sourcing Partnerships",
        "Build Industry Connections",
      ],
    },
    exhibitorHeading: { type: String, default: "WHY JOIN THE BUYER-SELLER MEET?" },
    exhibitorTitle: { type: String, default: "For Exhibitors" },
    exhibitorPoints: {
      type: [String],
      default: [
        "Meet Relevant Buyers",
        "Generate B2B Opportunities",
        "Expand Market Reach",
        "Explore Strategic Partnerships",
        "Build Brand Awareness",
      ],
    },
  },
  { timestamps: true }
);

const BuyerSellerMeetWhyJoin = mongoose.model(
  "OrganicBuyerSellerMeetWhyJoin",
  buyerSellerMeetWhyJoinSchema
);

export default BuyerSellerMeetWhyJoin;
