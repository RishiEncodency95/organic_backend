import mongoose, { Document, Schema } from "mongoose";

export interface IBlogPost extends Document {
  title: string;
  h1Title?: string;
  slug: string;
  excerpt?: string;
  content: string;
  category: string;
  author: string;
  tags: string[];
  status: "published" | "draft" | "scheduled" | "archived";
  showOnHome: boolean;
  featured: boolean;
  scheduledDate?: Date | null;
  readTime: string;
  image: string;
  imageAlt?: string;
  views: number;
  publishDate: Date;

  // SEO Fields
  metaTitle?: string;
  metaDescription?: string;
  metaKeywords?: string;
  canonicalUrl?: string;
  canonicalTag?: string;
  ogTitle?: string;
  ogDescription?: string;
  ogImage?: string;
  openGraphTags?: string;
  schemaMarkup?: string;

  createdAt: Date;
  updatedAt: Date;
  updatedBy?: string;
}

const BlogPostSchema = new Schema<IBlogPost>(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    h1Title: {
      type: String,
      trim: true,
      default: "",
    },
    slug: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
      index: true,
    },
    excerpt: {
      type: String,
      trim: true,
      default: "",
    },
    content: {
      type: String,
      required: true,
    },
    category: {
      type: String,
      default: "Expo News",
      trim: true,
    },
    author: {
      type: String,
      default: "Bharat Organic Expo Admin",
      trim: true,
    },
    tags: {
      type: [String],
      default: [],
    },
    status: {
      type: String,
      enum: ["published", "draft", "scheduled", "archived"],
      default: "published",
      index: true,
    },
    showOnHome: {
      type: Boolean,
      default: false,
      index: true,
    },
    featured: {
      type: Boolean,
      default: false,
      index: true,
    },
    scheduledDate: {
      type: Date,
      default: null,
    },
    readTime: {
      type: String,
      default: "4 min read",
      trim: true,
    },
    image: {
      type: String,
      default: "",
      trim: true,
    },
    imageAlt: {
      type: String,
      default: "",
      trim: true,
    },
    views: {
      type: Number,
      default: 0,
    },
    publishDate: {
      type: Date,
      default: Date.now,
      index: true,
    },

    updatedBy: {
      type: String,
      default: "",
      trim: true,
    },

    // Full SEO Metadata fields
    metaTitle: {
      type: String,
      default: "",
      trim: true,
    },
    metaDescription: {
      type: String,
      default: "",
      trim: true,
    },
    metaKeywords: {
      type: String,
      default: "",
      trim: true,
    },
    canonicalUrl: {
      type: String,
      default: "",
      trim: true,
    },
    canonicalTag: {
      type: String,
      default: "",
      trim: true,
    },
    ogTitle: {
      type: String,
      default: "",
      trim: true,
    },
    ogDescription: {
      type: String,
      default: "",
      trim: true,
    },
    ogImage: {
      type: String,
      default: "",
      trim: true,
    },
    openGraphTags: {
      type: String,
      default: "",
    },
    schemaMarkup: {
      type: String,
      default: "",
    },
  },
  {
    timestamps: true,
  }
);

// Auto-derive excerpt from content if missing
BlogPostSchema.pre("save", function (this: any) {
  if (!this.excerpt && this.content) {
    const plain = this.content.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
    this.excerpt = plain.slice(0, 180) + (plain.length > 180 ? "..." : "");
  }
  if (!this.h1Title && this.title) {
    this.h1Title = this.title;
  }
  if (!this.metaTitle && this.title) {
    this.metaTitle = this.title;
  }
  if (!this.ogTitle && this.title) {
    this.ogTitle = this.title;
  }
  if (!this.ogImage && this.image) {
    this.ogImage = this.image;
  }
});

export default mongoose.model<IBlogPost>("BlogPost", BlogPostSchema);
