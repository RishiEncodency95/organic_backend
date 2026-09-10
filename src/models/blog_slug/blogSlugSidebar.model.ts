import mongoose, { Schema, Document } from "mongoose";

export interface IBlogSlugSidebar extends Document {
  author?: {
    name?: string;
    description?: string;
  };
  relatedArticles?: Array<{
    title?: string;
    date?: string;
    image?: string;
  }>;
  categories?: Array<{
    name?: string;
    active?: boolean;
  }>;
}

const BlogSlugSidebarSchema = new Schema<IBlogSlugSidebar>(
  {
    author: {
      name: { type: String },
      description: { type: String },
    },
    relatedArticles: [
      {
        title: { type: String },
        date: { type: String },
        image: { type: String },
      },
    ],
    categories: [
      {
        name: { type: String },
        active: { type: Boolean },
      },
    ],
  },
  { timestamps: true }
);

export default mongoose.model<IBlogSlugSidebar>("BlogSlugSidebar", BlogSlugSidebarSchema);
