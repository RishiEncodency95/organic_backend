import mongoose, { Schema } from "mongoose";

/*
 * Blog categories, managed in the admin panel (Blog & Awareness → Manage Categories).
 * Blog posts store the category's name, so renaming a category also renames it on its posts.
 */

/** Icon and colour keys the admin can pick; the website and admin map each to the real icon / classes */
export const BLOG_CATEGORY_ICONS = [
  "newspaper", "sprout", "apple", "package", "recycle", "lightbulb", "file-text", "book-open",
  "leaf", "heart", "users", "megaphone", "calendar", "globe", "award", "trending-up",
] as const;
export const BLOG_CATEGORY_COLORS = [
  "sky", "green", "emerald", "orange", "teal", "amber", "rose", "cyan", "lime", "indigo", "violet", "slate",
] as const;
export const BLOG_CATEGORY_STATUSES = ["published", "hidden"] as const;

const blogCategorySchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, trim: true, lowercase: true, unique: true },
    description: { type: String, default: "", trim: true },
    icon: { type: String, enum: BLOG_CATEGORY_ICONS, default: "newspaper" },
    color: { type: String, enum: BLOG_CATEGORY_COLORS, default: "green" },
    /** Hidden categories stay usable for posts but are not listed on the website */
    status: { type: String, enum: BLOG_CATEGORY_STATUSES, default: "published", index: true },
    order: { type: Number, default: 0 },
  },
  { timestamps: true }
);

const BlogCategory = mongoose.model("OrganicBlogCategory", blogCategorySchema);
export default BlogCategory;
