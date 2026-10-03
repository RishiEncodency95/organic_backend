import { Request, Response } from "express";
import cloudinary, { isCloudinaryConfigured } from "../../config/cloudinary";
import asyncHandler from "../../utils/asyncHandler";
import { ApiResponse } from "../../utils/ApiResponse";
import { ApiError } from "../../utils/ApiError";
import Settings from "../../models/settings.model";

const DEFAULT_MAX_IMAGE_UPLOAD_KB = 500;

async function getMaxImageUploadSizeKB(): Promise<number> {
  try {
    const doc = await Settings.findOne({ website: "Organicexpo" }).lean();
    const configured = (doc?.data as Record<string, any> | undefined)?.maxImageUploadSizeKB;
    const parsed = Number(configured);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_MAX_IMAGE_UPLOAD_KB;
  } catch {
    return DEFAULT_MAX_IMAGE_UPLOAD_KB;
  }
}

/**
 * Upload single file (Cloudinary primary, local fallback)
 * POST /api/uploads
 */
export const uploadFile = asyncHandler(async (req: Request, res: Response) => {
  const file = req.file;
  if (!file) {
    throw ApiError.badRequest("No file uploaded. Please attach a file.");
  }

  if (file.mimetype.startsWith("image/")) {
    const maxKB = await getMaxImageUploadSizeKB();
    const fileKB = file.size / 1024;
    if (fileKB > maxKB) {
      throw ApiError.badRequest(
        `File size is too large (${fileKB.toFixed(0)} KB). Please reduce the file size — images larger than ${maxKB} KB cannot be uploaded.`
      );
    }
  }

  const folder = (req.query.folder as string) || "bharat-organic/content";

  // Cloudinary only — deliberately no local-disk fallback. A silent local
  // fallback here is exactly how a batch of images ended up saved to
  // public/uploads instead of Cloudinary without anyone noticing; failing
  // loudly means a misconfigured server is caught immediately instead of
  // quietly bloating the site.
  if (!isCloudinaryConfigured()) {
    throw ApiError.badRequest(
      "Cloudinary is not configured on this server (missing CLOUDINARY_CLOUD_NAME / CLOUDINARY_API_KEY / CLOUDINARY_API_SECRET). Uploads are disabled until it is."
    );
  }

  // PDFs go up as "raw" files (chunked, so size isn't limited by single-request caps).
  // Cloudinary answers public PDF URLs with 401 unless "Allow delivery of PDF and ZIP
  // files" is enabled on the account — which is why brochures broke live — so the URL
  // handed back is our own /api/files/pdf proxy (modules/files) rather than the CDN URL.
  // Raw public_ids only carry an extension when given one, so ".pdf" is added explicitly.
  const isPdf = file.mimetype === "application/pdf" || /\.pdf$/i.test(file.originalname || "");
  const pdfBaseName =
    (file.originalname || "document")
      .replace(/\.pdf$/i, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "document";

  try {
    const result = await new Promise<{ secure_url: string; public_id: string }>((resolve, reject) => {
      const callback = (error: any, result: any) => {
        if (error || !result) {
          return reject(error || new Error("Cloudinary upload failed"));
        }
        resolve({
          secure_url: result.secure_url,
          public_id: result.public_id,
        });
      };

      const uploadStream = isPdf
        ? // Chunked so large brochures go through (single requests are capped at 100MB).
          cloudinary.uploader.upload_chunked_stream(
            {
              folder,
              resource_type: "raw",
              public_id: `${pdfBaseName}-${Date.now()}.pdf`,
              chunk_size: 20 * 1024 * 1024,
            },
            callback
          )
        : cloudinary.uploader.upload_stream({ folder, resource_type: "auto" }, callback);
      uploadStream.end(file.buffer);
    });

    res.status(200).json(
      new ApiResponse(200, "File uploaded to Cloudinary successfully", {
        // Relative on purpose: the website and admin both forward /api to this server.
        url: isPdf ? `/api/files/pdf?url=${encodeURIComponent(result.secure_url)}` : result.secure_url,
        publicId: result.public_id,
      })
    );
    return;
  } catch (cloudErr: any) {
    console.error("Cloudinary upload error:", cloudErr);
    throw ApiError.badRequest(cloudErr?.message || "Failed to upload file to Cloudinary");
  }
});
