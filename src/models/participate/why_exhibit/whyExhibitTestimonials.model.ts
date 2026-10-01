import mongoose, { Schema } from "mongoose";

// Same shape as the homepage testimonials (models/home/testimonialsCarousel.model.ts) so
// the admin "Exhibitor Testimonials" screen can share the Testimonials management UI.
const exhibitorTestimonialSchema = new Schema(
  {
    company1: { type: String, default: "" }, // reviewer name
    company2: { type: String, default: "" }, // role / company
    location: { type: String, default: "" },
    quote: { type: String, default: "" },
    rating: { type: Number, default: 5 },
    color: { type: String, default: "#1b5e20" },
    logoText: { type: String, default: "" },
    logo: { type: String, default: "" }, // optional photo; initials are shown when empty
    logoAlt: { type: String, default: "" },
    status: { type: String, default: "Published" },
    author: { type: String, default: "Vansh Chaudhary" },
    addedOn: { type: String, default: "" },
    date: { type: String, default: "" },
  },
  { timestamps: true }
);

const whyExhibitTestimonialsSchema = new Schema(
  {
    testimonials: {
      type: [exhibitorTestimonialSchema],
      default: [],
    },
  },
  { timestamps: true }
);

// New collection name: the old per-item collection ("OrganicWhyExhibitTestimonials") only
// ever held auto-seeded demo rows and is no longer read.
const WhyExhibitTestimonials = mongoose.model("OrganicExhibitorTestimonials", whyExhibitTestimonialsSchema);
export default WhyExhibitTestimonials;
