import mongoose, { Schema } from "mongoose";

const awardsStatsSchema = new Schema(
  {
    enabled: { type: Boolean, default: true },
    eyebrow: { type: String, default: "AWARDS STATS" },
    title: { type: String, default: "Key Metrics & Scale" },
    items: [
      {
        id: { type: Number },
        icon: { type: String, default: "" },
        title: { type: String, default: "" },
        subtitle: { type: String, default: "" },
        label: { type: String, default: "" },
      },
    ],
  },
  { timestamps: true }
);

const AwardsStats = mongoose.model("OrganicAwardsStats", awardsStatsSchema);
export default AwardsStats;
