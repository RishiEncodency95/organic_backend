import mongoose, { Schema } from "mongoose";

/*
 * One downloadable PDF in the blog's "Reports & Resources" (website /blog and /blog/reports),
 * managed in the admin panel (Blog & Insights → Manage Reports).
 */

export const BLOG_REPORT_STATUSES = ["published", "hidden"] as const;

const blogReportSchema = new Schema(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, default: "", trim: true },
    /** The uploaded PDF: "/api/files/pdf?url=<cloudinary pdf>" as the upload returns it.
     *  Empty until a PDF is uploaded — the website then shows the report as "Coming soon". */
    fileUrl: { type: String, default: "", trim: true },
    /** Original file name, shown in the admin */
    fileName: { type: String, default: "", trim: true },
    /** Bytes, shown as "PDF · 2.5 MB" */
    fileSize: { type: Number, default: 0, min: 0 },
    downloads: { type: Number, default: 0, min: 0 },
    status: { type: String, enum: BLOG_REPORT_STATUSES, default: "published", index: true },
    order: { type: Number, default: 0 },
  },
  { timestamps: true }
);

const BlogReport = mongoose.model("OrganicBlogReport", blogReportSchema);
export default BlogReport;
