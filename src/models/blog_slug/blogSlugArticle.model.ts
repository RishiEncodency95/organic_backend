import mongoose, { Schema, Document } from "mongoose";

export interface IBlogSlugArticle extends Document {
  breadcrumbs?: Array<{
    label?: string;
    href?: string;
  }>;
  category?: string;
  title?: string;
  description?: string;
  meta?: {
    date?: string;
    readTime?: string;
    views?: string;
  };
  image?: string;
  paragraphs?: string[];
  sections?: Array<{
    id?: number;
    title?: string;
    content?: string;
    type?: string;
    statsData?: Array<{
      icon?: string;
      value?: string;
      label?: string;
    }>;
    listData?: Array<{
      title?: string;
      desc?: string;
    }>;
    cardsData?: Array<{
      icon?: string;
      title?: string;
      desc?: string;
    }>;
    quoteData?: {
      main?: string;
      sub?: string;
    };
  }>;
}

const BlogSlugArticleSchema = new Schema<IBlogSlugArticle>(
  {
    breadcrumbs: [
      {
        label: { type: String },
        href: { type: String },
      },
    ],
    category: { type: String },
    title: { type: String },
    description: { type: String },
    meta: {
      date: { type: String },
      readTime: { type: String },
      views: { type: String },
    },
    image: { type: String },
    paragraphs: [{ type: String }],
    sections: [
      {
        id: { type: Number },
        title: { type: String },
        content: { type: String },
        type: { type: String },
        statsData: [
          {
            icon: { type: String },
            value: { type: String },
            label: { type: String },
          },
        ],
        listData: [
          {
            title: { type: String },
            desc: { type: String },
          },
        ],
        cardsData: [
          {
            icon: { type: String },
            title: { type: String },
            desc: { type: String },
          },
        ],
        quoteData: {
          main: { type: String },
          sub: { type: String },
        },
      },
    ],
  },
  { timestamps: true }
);

export default mongoose.model<IBlogSlugArticle>("BlogSlugArticle", BlogSlugArticleSchema);
