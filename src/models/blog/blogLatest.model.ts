import mongoose, { Schema, Document } from "mongoose";

export interface IBlogLatest extends Document {
  title?: string;
  actionText?: string;
  updates?: Array<{
    tag?: string;
    img?: string;
    title?: string;
    desc?: string;
    date?: string;
    read?: string;
    link?: string;
  }>;
}

const BlogLatestSchema = new Schema<IBlogLatest>(
  {
    title: { type: String },
    actionText: { type: String },
    updates: [
      {
        tag: { type: String },
        img: { type: String },
        title: { type: String },
        desc: { type: String },
        date: { type: String },
        read: { type: String },
        link: { type: String },
      },
    ],
  },
  { timestamps: true }
);

export default mongoose.model<IBlogLatest>("BlogLatest", BlogLatestSchema);
