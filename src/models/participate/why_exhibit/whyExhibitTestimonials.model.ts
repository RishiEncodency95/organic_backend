import mongoose, { Schema } from "mongoose";

const testimonialItemSchema = new Schema(
  {
    companyName1: { type: String, required: true },
    companyName2: { type: String, default: "" },
    location: { type: String, default: "" },
    quote: { type: String, required: true },
    initials: { type: String, default: "GE" },
    color: { type: String, default: "#1b5e20" },
  },
  { timestamps: true }
);

const WhyExhibitTestimonials = mongoose.model("OrganicWhyExhibitTestimonials", testimonialItemSchema);
export default WhyExhibitTestimonials;
