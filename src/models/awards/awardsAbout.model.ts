import mongoose, { Schema } from "mongoose";

const awardsAboutSchema = new Schema(
  {
    enabled: { type: Boolean, default: true },
    title: { type: String, default: "About the Awards" },
    description: {
      type: String,
      default:
        "Bharat Organic Excellence Awards 2027 recognise outstanding organisations, brands, entrepreneurs, farmers and professionals for their remarkable contribution to the growth and promotion of the organic, natural and sustainable industry.",
    },
  },
  { timestamps: true }
);

const AwardsAbout = mongoose.model("OrganicAwardsAbout", awardsAboutSchema);
export default AwardsAbout;
