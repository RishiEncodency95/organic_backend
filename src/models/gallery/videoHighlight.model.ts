import mongoose, { Schema } from "mongoose";

const videoHighlightSchema = new Schema(
  {
    title: { type: String, required: true, trim: true },
    category: { type: String, default: "" },
    videoType: { type: String, enum: ["youtube", "instagram", "upload"], default: "youtube" },
    videoUrl: { type: String, required: true },
    thumbnail: { type: String, default: "" },
    objectPosition: { type: String, default: "center 10%" },
    status: { type: String, enum: ["Published", "Draft"], default: "Published" },
    order: { type: Number, default: 1 },
    uploadedBy: { type: String, default: "" },
    date: { type: String, default: "" },
    time: { type: String, default: "" },
  },
  { timestamps: true }
);

const VideoHighlight = mongoose.model("VideoHighlight", videoHighlightSchema);
export default VideoHighlight;
