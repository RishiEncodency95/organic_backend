import { Request, Response } from "express";
import cloudinary, { isCloudinaryConfigured } from "../../config/cloudinary";
import asyncHandler from "../../utils/asyncHandler";
import { ApiResponse } from "../../utils/ApiResponse";
import { ApiError } from "../../utils/ApiError";
import fs from "fs";
import path from "path";

/**
 * Upload single file (Cloudinary primary, local fallback)
 * POST /api/uploads
 */
export const uploadFile = asyncHandler(async (req: Request, res: Response) => {
  const file = req.file;
  if (!file) {
    throw ApiError.badRequest("No file uploaded. Please attach a file.");
  }

  const folder = (req.query.folder as string) || "bharat-organic/content";

  // If Cloudinary is available, upload directly to Cloudinary
  if (isCloudinaryConfigured()) {
    try {
      const result = await new Promise<{ secure_url: string; public_id: string }>((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
          {
            folder,
            resource_type: "auto",
          },
          (error, result) => {
            if (error || !result) {
              return reject(error || new Error("Cloudinary upload failed"));
            }
            resolve({
              secure_url: result.secure_url,
              public_id: result.public_id,
            });
          }
        );
        uploadStream.end(file.buffer);
      });

      return res.status(200).json(
        new ApiResponse(200, "File uploaded to Cloudinary successfully", {
          url: result.secure_url,
          publicId: result.public_id,
        })
      );
    } catch (cloudErr) {
      console.error("Cloudinary upload stream error, falling back to local:", cloudErr);
    }
  }

  // Local filesystem fallback
  const localDir = path.join(process.cwd(), "public", "uploads", folder.replace(/[^a-zA-Z0-9_-]/g, "_"));
  if (!fs.existsSync(localDir)) {
    fs.mkdirSync(localDir, { recursive: true });
  }

  const sanitizedOriginalName = file.originalname.replace(/\s+/g, "-");
  const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1e9)}${path.extname(sanitizedOriginalName)}`;
  const filePath = path.join(localDir, uniqueName);

  fs.writeFileSync(filePath, file.buffer);

  const relativeUrl = `/uploads/${folder.replace(/[^a-zA-Z0-9_-]/g, "_")}/${uniqueName}`;

  return res.status(200).json(
    new ApiResponse(200, "File saved locally successfully", {
      url: relativeUrl,
      publicId: uniqueName,
    })
  );
});
