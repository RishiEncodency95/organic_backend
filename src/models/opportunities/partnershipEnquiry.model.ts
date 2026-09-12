import mongoose, { Schema } from "mongoose";

const categoryItemSchema = new Schema(
  {
    label: { type: String, default: "" },
    value: { type: String, default: "" },
  },
  { _id: false }
);

const partnershipEnquirySchema = new Schema(
  {
    leftTitle: { type: String, default: "CUSTOM PARTNERSHIP\nPACKAGES AVAILABLE" },
    leftDesc: {
      type: String,
      default:
        "We offer customized partnership solutions tailored to your marketing goals and budget.",
    },
    leftButtonText: { type: String, default: "LET'S COLLABORATE" },
    formTitle: { type: String, default: "INTERESTED IN PARTNERSHIP?" },
    formSubtitle: {
      type: String,
      default: "Fill in your details and our team will get in touch with you.",
    },
    contactEmail: { type: String, default: "info@namogangewellness.com" },
    contactPhone: { type: String, default: "+91-9654900525" },
    contactWebsite: { type: String, default: "bharatorganicexpo.com" },
    contactWebsiteUrl: { type: String, default: "https://bharatorganicexpo.com/" },
    contactLocationLine1: { type: String, default: "Pragati Maidan," },
    contactLocationLine2: { type: String, default: "New Delhi, India" },
    categories: {
      type: [categoryItemSchema],
      default: [
        { label: "Hotel & Stay Partner", value: "Hotel & Stay" },
        { label: "Travel Partner", value: "Travel" },
        { label: "Stall Design & Fabrication", value: "Stall Design" },
        { label: "Logistics Partner", value: "Logistics" },
        { label: "Printing & Branding", value: "Printing" },
        { label: "Manpower Supply Partner", value: "Manpower Supply" },
        { label: "Custom Partnership", value: "Custom" },
      ],
    },
  },
  { timestamps: true }
);

const PartnershipEnquiry = mongoose.model(
  "OrganicPartnershipEnquiry",
  partnershipEnquirySchema
);

export default PartnershipEnquiry;
