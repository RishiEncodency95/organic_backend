import mongoose, { Schema } from "mongoose";

const participantCardSchema = new Schema(
  {
    icon: { type: String, default: "" },
    title: { type: String, default: "" },
    desc: { type: String, default: "" },
  },
  { _id: false }
);

const buyerSellerMeetWhoCanParticipateSchema = new Schema(
  {
    title: { type: String, default: "WHO CAN PARTICIPATE AS A BUYER?" },
    subtitle: {
      type: String,
      default: "Meet Suppliers Across the Complete Organic Industry Ecosystem",
    },
    cards: {
      type: [participantCardSchema],
      default: [
        { icon: "img21", title: "Importers & Exporters", desc: "Explore products, sourcing opportunities and global partnerships." },
        { icon: "img22", title: "Distributors & Wholesalers", desc: "Discover new brands and expand product portfolios." },
        { icon: "img23", title: "Retail Chains & Supermarkets", desc: "Source organic, natural, wellness and sustainable products." },
        { icon: "img24", title: "E-commerce & Marketplace Buyers", desc: "Discover emerging and established consumer brands." },
        { icon: "img25", title: "Institutional Buyers", desc: "Connect with manufacturers and suppliers for institutional procurement requirements." },
        { icon: "img26", title: "Hotels, Restaurants & HoReCa", desc: "Source food, beverages, wellness and sustainable products." },
        { icon: "img27", title: "Manufacturers & Private Label Buyers", desc: "Explore contract manufacturing, ingredients, private-label opportunities." },
        { icon: "img28", title: "Corporate Procurement Teams", desc: "Identify relevant products, suppliers and sustainable sourcing solutions." },
        { icon: "img29", title: "International Trade Delegations", desc: "Explore Indian suppliers, manufacturers and potential trade partnerships." },
      ],
    },
    sideCardTitle: { type: String, default: "MEET.\nCONNECT.\nCOLLABORATE.\nGROW." },
    sideCardDesc: {
      type: String,
      default: "Be part of India's leading B2B networking platform for the organic industry.",
    },
  },
  { timestamps: true }
);

const BuyerSellerMeetWhoCanParticipate = mongoose.model(
  "OrganicBuyerSellerMeetWhoCanParticipate",
  buyerSellerMeetWhoCanParticipateSchema
);

export default BuyerSellerMeetWhoCanParticipate;
