import mongoose, { Schema } from "mongoose";

const connectItemSchema = new Schema(
  {
    icon: { type: String, default: "" },
    label: { type: String, default: "" },
  },
  { _id: false }
);

const buyerSellerMeetConnectWithSchema = new Schema(
  {
    heading: { type: String, default: "WHO WILL YOU CONNECT WITH?" },
    items: {
      type: [connectItemSchema],
      default: [
        { icon: "Tag", label: "Brands" },
        { icon: "Cog", label: "Manufacturers" },
        { icon: "Leaf", label: "Producers" },
        { icon: "Truck", label: "Suppliers" },
        { icon: "Globe2", label: "Importers" },
        { icon: "ArrowRightLeft", label: "Exporters" },
        { icon: "Store", label: "Distributors" },
        { icon: "ShoppingBag", label: "Wholesalers" },
        { icon: "Building", label: "Retailers" },
        { icon: "MonitorSmartphone", label: "E-commerce\nBuyers" },
        { icon: "UtensilsCrossed", label: "HoReCa\nBuyers" },
        { icon: "Flag", label: "Trade\nBodies" },
        { icon: "Network", label: "International\nDelegations" },
      ],
    },
  },
  { timestamps: true }
);

const BuyerSellerMeetConnectWith = mongoose.model(
  "OrganicBuyerSellerMeetConnectWith",
  buyerSellerMeetConnectWithSchema
);

export default BuyerSellerMeetConnectWith;
