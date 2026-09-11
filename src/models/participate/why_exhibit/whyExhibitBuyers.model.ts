import mongoose, { Schema } from "mongoose";

const buttonSchema = new Schema(
  {
    label: { type: String, default: "Book Your Stall" },
    href: { type: String, default: "/registration/book-a-stand" },
  },
  { _id: false }
);

const visualItemSchema = new Schema(
  {
    img: { type: String, default: "" },
    label: { type: String, required: true },
  },
  { _id: false }
);

const whyExhibitBuyersSchema = new Schema(
  {
    titlePrefix: { type: String, default: "WHO SHOULD " },
    titleHighlight: { type: String, default: "ATTEND?" },
    attendees: {
      type: [String],
      default: [
        "Hospitals, Clinics & Healthcare Providers",
        "Importers, Exporters & Distributors",
        "Pharmacies & Retail Chains",
        "Wellness Centres & Spa Chains",
        "E-commerce & Online Retailers",
        "Government & Institutional Buyers",
        "Investors & Business Partners",
        "Researchers & Academicians",
      ],
    },
    button: { type: buttonSchema, default: () => ({}) },
    visuals: {
      type: [visualItemSchema],
      default: [
        { img: "", label: "Organic Buyers Meet" },
        { img: "", label: "B2B Networking" },
        { img: "", label: "Business Deals" },
      ],
    },
  },
  { timestamps: true }
);

const WhyExhibitBuyers = mongoose.model("OrganicWhyExhibitBuyers", whyExhibitBuyersSchema);
export default WhyExhibitBuyers;
