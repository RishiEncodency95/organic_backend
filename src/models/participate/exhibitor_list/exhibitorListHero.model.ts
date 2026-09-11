import mongoose, { Schema } from "mongoose";

const buttonSchema = new Schema(
  {
    label: { type: String, default: "" },
    href: { type: String, default: "" },
    variant: { type: String, default: "blue" },
    target: { type: String, default: "_blank" },
  },
  { _id: false }
);

const exhibitorListHeroSchema = new Schema(
  {
    tagline: { type: String, default: "TRUSTED BY" },
    mainCount: { type: String, default: "150+ " },
    countHighlight: { type: String, default: "Leading" },
    titleSub: { type: String, default: "Health & Wellness Brands" },
    description: {
      type: String,
      default:
        "India's most influential health, Ayurveda, fitness and wellness companies have chosen Bharat Organic Expo as the platform to showcase, connect and grow.",
    },
    eventDate: { type: String, default: "19-21 February 2027" },
    eventLocation: { type: String, default: "Hall 12, Bharat Mandapam, New Delhi" },
    bgImage: { type: String, default: "" },
    leafImage: { type: String, default: "" },
    buttons: {
      type: [buttonSchema],
      default: [
        { label: "REGISTER AS A BUYER", href: "/registration/buyer-registration", variant: "blue", target: "_blank" },
        { label: "PARTICIPATE AS AN EXHIBITOR", href: "/registration/book-a-stand", variant: "orange", target: "_blank" },
      ],
    },
  },
  { timestamps: true }
);

const ExhibitorListHero = mongoose.model("OrganicExhibitorListHero", exhibitorListHeroSchema);
export default ExhibitorListHero;
