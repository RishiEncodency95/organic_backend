import mongoose, { Schema } from "mongoose";

/*
 * One card in the blog's "Latest from Bharat Organic Expo" (website /blog and /blog/updates),
 * managed in the admin panel (Blog & Insights → Manage Updates).
 */

export const BLOG_UPDATE_STATUSES = ["published", "hidden"] as const;

const blogUpdateSchema = new Schema(
  {
    tag: { type: String, required: true, trim: true },
    title: { type: String, required: true, trim: true },
    description: { type: String, required: true, trim: true },
    /** Image URL; empty shows one of the website's default update images */
    image: { type: String, default: "", trim: true },
    /** The date shown on the card */
    date: { type: Date, required: true },
    readMinutes: { type: Number, default: 3, min: 1, max: 60 },
    /** Where the card leads: a site path (/blog/…) or a full https:// link; empty = not clickable */
    link: { type: String, default: "", trim: true },
    status: { type: String, enum: BLOG_UPDATE_STATUSES, default: "published", index: true },
    order: { type: Number, default: 0 },
  },
  { timestamps: true }
);

const BlogUpdate = mongoose.model("OrganicBlogUpdate", blogUpdateSchema);
export default BlogUpdate;
