import mongoose, { Schema } from "mongoose";

const awardsCelebratingLeadersSchema = new Schema(
  {
    enabled: { type: Boolean, default: true },
    badge: { type: String, default: "Bharat Organic Excellence Awards 2027" },
    titlePrimary: { type: String, default: "Celebrating India's" },
    titleSecondary: { type: String, default: "Organic Leaders" },
    description: {
      type: String,
      default:
        "From farm to shelf, we honour the changemakers who are building a cleaner, healthier and more sustainable India.",
    },
    leaderTypes: [
      {
        id: { type: Number },
        icon: { type: String, default: "" },
        label: { type: String, default: "" },
      },
    ],
  },
  { timestamps: true }
);

const AwardsCelebratingLeaders = mongoose.model(
  "OrganicAwardsCelebratingLeaders",
  awardsCelebratingLeadersSchema
);
export default AwardsCelebratingLeaders;
