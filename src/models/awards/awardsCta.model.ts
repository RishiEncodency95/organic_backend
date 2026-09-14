import mongoose, { Schema } from "mongoose";

const awardsCtaSchema = new Schema(
  {
    enabled: { type: Boolean, default: true },
    titleLine1: { type: String, default: "Be Recognised." },
    titleLine2: { type: String, default: "Be Celebrated." },
    titleHighlight: { type: String, default: "Be Part of India's" },
    titleLine3: { type: String, default: "Organic Revolution." },
    description: {
      type: String,
      default:
        "Nominate yourself or someone who inspires change in the organic and sustainable world.",
    },
    buttonLabel: { type: String, default: "Nominate Now" },
    buttonHref: { type: String, default: "/awards/nominations" },
    deadlineText: { type: String, default: "Deadline: 31 December 2026" },
  },
  { timestamps: true }
);

const AwardsCta = mongoose.model("OrganicAwardsCta", awardsCtaSchema);
export default AwardsCta;
