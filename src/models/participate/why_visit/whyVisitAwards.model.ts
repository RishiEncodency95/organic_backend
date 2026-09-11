import mongoose, { Schema } from "mongoose";

const valueCardSchema = new Schema(
  {
    image: { type: String, default: "" },
    titleLine1: { type: String, default: "" },
    titleLine2: { type: String, default: "" },
    desc: { type: String, default: "" },
  },
  { _id: false }
);

const whyVisitAwardsSchema = new Schema(
  {
    badge: { type: String, default: "VALUE BEYOND BUSINESS" },
    title: { type: String, default: "AWARDS & RECOGNITION" },
    subline: { type: String, default: "CELEBRATING EXCELLENCE. INSPIRING IMPACT." },
    desc: {
      type: String,
      default:
        "Honouring innovation, leadership and impactful contributions that are shaping a healthier, sustainable and organic future.",
    },
    valueCards: {
      type: [valueCardSchema],
      default: [
        {
          image: "",
          titleLine1: "Recognizing",
          titleLine2: "Excellence",
          desc: "Celebrate outstanding achievements across the organic ecosystem.",
        },
        {
          image: "",
          titleLine1: "Inspiring",
          titleLine2: "Innovation",
          desc: "Encouraging new ideas and solutions for a sustainable future.",
        },
        {
          image: "",
          titleLine1: "Building",
          titleLine2: "Credibility",
          desc: "Gain industry recognition and strengthen your brand value.",
        },
        {
          image: "",
          titleLine1: "Wider",
          titleLine2: "Visibility",
          desc: "Showcase your success to a global audience of buyers and leaders.",
        },
        {
          image: "",
          titleLine1: "Driving",
          titleLine2: "Impact",
          desc: "Inspire meaningful change and contribute to a better, healthier world.",
        },
      ],
    },
  },
  { timestamps: true }
);

const WhyVisitAwards = mongoose.model("OrganicWhyVisitAwards", whyVisitAwardsSchema);
export default WhyVisitAwards;
