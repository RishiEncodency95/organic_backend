import mongoose, { Schema, Document } from "mongoose";

export interface IBlogVideos extends Document {
  title?: string;
  actionText?: string;
  videos?: Array<{
    img?: string;
    title?: string;
    duration?: string;
  }>;
}

const BlogVideosSchema = new Schema<IBlogVideos>(
  {
    title: { type: String },
    actionText: { type: String },
    videos: [
      {
        img: { type: String },
        title: { type: String },
        duration: { type: String },
      },
    ],
  },
  { timestamps: true }
);

export default mongoose.model<IBlogVideos>("BlogVideos", BlogVideosSchema);
