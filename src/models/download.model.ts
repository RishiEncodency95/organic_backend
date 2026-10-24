import mongoose, { Schema } from "mongoose";

/*
 * One downloadable PDF in the website navbar's "Download" menu, managed in the admin panel
 * (Content Management → Downloads). Only "active" items are shown on the website.
 */

export const DOWNLOAD_STATUSES = ["active", "inactive"] as const;
export type DownloadStatus = (typeof DOWNLOAD_STATUSES)[number];

const downloadSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    /** Cloudinary URL of the PDF */
    fileUrl: { type: String, required: true, trim: true },
    /** Original file name, e.g. "brochure-2027.pdf" */
    fileName: { type: String, default: "", trim: true },
    /** Bytes */
    fileSize: { type: Number, default: 0 },
    /** Always "pdf": only PDFs are accepted */
    fileFormat: { type: String, default: "pdf", enum: ["pdf"] },
    status: { type: String, enum: DOWNLOAD_STATUSES, default: "active", index: true },
    /** Lower numbers are shown first */
    orderBy: { type: Number, default: 0, index: true },
    addedBy: { type: Schema.Types.ObjectId, ref: "Admin", default: null },
    updatedBy: { type: Schema.Types.ObjectId, ref: "Admin", default: null },
  },
  { timestamps: true }
);

const Download = mongoose.model("Download", downloadSchema);
export default Download;
