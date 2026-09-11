import mongoose, { Schema } from "mongoose";

const buttonSchema = new Schema(
  {
    label: { type: String, default: "" },
    href: { type: String, default: "" },
    type: { type: String, default: "orange" },
    target: { type: String, default: "_blank" },
  },
  { _id: false }
);

const statSchema = new Schema(
  {
    value: { type: String, required: true },
    label: { type: String, required: true },
  },
  { _id: false }
);

const exhibitorListCtaSchema = new Schema(
  {
    tagline: { type: String, default: "These brands trust Bharat Organic Expo." },
    title: { type: String, default: "Be the next success story." },
    description: { type: String, default: "Join India's most trusted platform for health, wellness and holistic living." },
    beImg: { type: String, default: "" },
    leafImg: { type: String, default: "" },
    buttons: {
      type: [buttonSchema],
      default: [
        { label: "Book Your Stall", href: "/registration/book-a-stand", type: "orange", target: "_blank" },
        { label: "Download Brochure", href: "/download/invited card.pdf", type: "maroon", target: "_blank" },
      ],
    },
    bottomStats: {
      type: [statSchema],
      default: [
        { value: "200+", label: "Exhibitors" },
        { value: "8,000+", label: "Visitors" },
        { value: "3 Days", label: "Of Knowledge" },
        { value: "PAN India", label: "Participation" },
        { value: "B2B + B2C", label: "Business Opportunity" },
      ],
    },
  },
  { timestamps: true }
);

const ExhibitorListCta = mongoose.model("OrganicExhibitorListCta", exhibitorListCtaSchema);
export default ExhibitorListCta;
