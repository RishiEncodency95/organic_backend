import mongoose, { Schema } from "mongoose";

const exhibitorListHeaderSchema = new Schema(
  {
    title: { type: String, default: "Our Previous Exhibitors" },
    subtitle: { type: String, default: "A Platform Trusted by Industry Leaders" },
  },
  { timestamps: true }
);

const ExhibitorListHeader = mongoose.model("OrganicExhibitorListHeader", exhibitorListHeaderSchema);
export default ExhibitorListHeader;
