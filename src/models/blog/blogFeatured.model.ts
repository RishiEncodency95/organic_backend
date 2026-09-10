import mongoose, { Schema, Document } from "mongoose";

export interface IBlogFeatured extends Document {
  title?: string;
  actionText?: string;
  articles?: Array<{
    tag?: string;
    img?: string;
    title?: string;
    desc?: string;
    date?: string;
    read?: string;
  }>;
}

const BlogFeaturedSchema = new Schema<IBlogFeatured>(
  {
    title: { type: String },
    actionText: { type: String },
    articles: [
      {
        tag: { type: String },
        img: { type: String },
        title: { type: String },
        desc: { type: String },
        date: { type: String },
        read: { type: String },
      },
    ],
  },
  { timestamps: true }
);

export default mongoose.model<IBlogFeatured>("BlogFeatured", BlogFeaturedSchema);
