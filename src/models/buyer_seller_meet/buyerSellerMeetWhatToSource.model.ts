import mongoose, { Schema } from "mongoose";

const sourceCardSchema = new Schema(
  {
    img: { type: String, default: "" },
    title: { type: String, default: "" },
    list: { type: [String], default: [] },
    color: { type: String, default: "" },
  },
  { _id: false }
);

const buyerSellerMeetWhatToSourceSchema = new Schema(
  {
    title: { type: String, default: "WHAT CAN BUYERS SOURCE?" },
    subtitle: { type: String, default: "6 Industry Segments. One Business Platform." },
    cards: {
      type: [sourceCardSchema],
      default: [
        {
          img: "img1",
          title: "ORGANIC FOOD & NUTRITION",
          list: ["Food", "Beverages", "Nutraceuticals", "Functional Nutrition"],
          color: "text-[#1b5e20]",
        },
        {
          img: "img2",
          title: "AYUSH, HERBAL\n& WELLNESS",
          list: ["Ayurveda", "Herbal", "Wellness", "Traditional Health Solutions"],
          color: "text-[#5d4037]",
        },
        {
          img: "img3",
          title: "ORGANIC AGRICULTURE",
          list: ["Farming", "Inputs", "Seeds", "Bio-Inputs"],
          color: "text-[#2e7d32]",
        },
        {
          img: "img4",
          title: "NATURAL LIVING &\nPERSONAL CARE",
          list: ["Beauty", "Personal Care", "Natural Lifestyle Products"],
          color: "text-[#6a1b9a]",
        },
        {
          img: "img5",
          title: "GREENTECH &\nSUSTAINABILITY",
          list: ["AgriTech", "GreenTech", "Sustainable Packaging", "Processing"],
          color: "text-[#00695c]",
        },
        {
          img: "img6",
          title: "TRADE, CERTIFICATION\n& GLOBAL BUSINESS",
          list: ["Certification", "Export", "Import", "Trade & Business Services"],
          color: "text-[#e65100]",
        },
      ],
    },
  },
  { timestamps: true }
);

const BuyerSellerMeetWhatToSource = mongoose.model(
  "OrganicBuyerSellerMeetWhatToSource",
  buyerSellerMeetWhatToSourceSchema
);

export default BuyerSellerMeetWhatToSource;
