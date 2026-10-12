import mongoose, { Schema } from "mongoose";

/*
 * One expert in the blog's "Voices of Experts" (website /blog and /blog/experts),
 * managed in the admin panel (Blog & Insights → Blog Experts).
 */

export const BLOG_EXPERT_STATUSES = ["published", "hidden"] as const;

const blogExpertSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    role: { type: String, required: true, trim: true },
    quote: { type: String, required: true, trim: true },
    /** Photo URL; empty shows the website's default expert photo */
    image: { type: String, default: "", trim: true },
    status: { type: String, enum: BLOG_EXPERT_STATUSES, default: "published", index: true },
    order: { type: Number, default: 0 },
  },
  { timestamps: true }
);

const BlogExpert = mongoose.model("OrganicBlogExpert", blogExpertSchema);
export default BlogExpert;
