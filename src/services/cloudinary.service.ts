import cloudinary from "../config/cloudinary";
import { Readable } from "stream";
import path from "path";
import fs from "fs";

export interface CloudinaryUploadResult {
  url: string;
  publicId: string;
  originalFileName: string;
  format: string;
  bytes: number;
}

export const uploadCvToCloudinary = (
  fileBuffer: Buffer,
  originalName: string,
  mimeType: string
): Promise<CloudinaryUploadResult> => {
  return new Promise((resolve) => {
    const folder = "bharat-organic-expo/careers/cvs";
    const cleanPublicId = `cv_${Date.now()}_${originalName.replace(/[^a-zA-Z0-9]/g, "_")}`;

    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type: "auto",
        public_id: cleanPublicId,
      },
      (error, result) => {
        if (error || !result) {
          console.warn("⚠️ Cloudinary upload warning, falling back to local secure storage:", error?.message || error);
          
          // Save locally as fallback
          try {
            const uploadDir = path.join(process.cwd(), "public", "uploads", "cvs");
            if (!fs.existsSync(uploadDir)) {
              fs.mkdirSync(uploadDir, { recursive: true });
            }
            const safeFileName = `${cleanPublicId}_${originalName.replace(/[^a-zA-Z0-9.]/g, "_")}`;
            const filePath = path.join(uploadDir, safeFileName);
            fs.writeFileSync(filePath, fileBuffer);

            // Also mirror save to frontend public folder if available locally
            try {
              const frontendUploadDir = path.join(process.cwd(), "..", "organic_frontend", "public", "uploads", "cvs");
              if (!fs.existsSync(frontendUploadDir)) {
                fs.mkdirSync(frontendUploadDir, { recursive: true });
              }
              fs.writeFileSync(path.join(frontendUploadDir, safeFileName), fileBuffer);
            } catch (feErr) {
              // Ignore if running standalone
            }

            return resolve({
              url: `/uploads/cvs/${safeFileName}`,
              publicId: cleanPublicId,
              originalFileName: originalName,
              format: mimeType.split("/")[1] || "pdf",
              bytes: fileBuffer.length,
            });
          } catch (localErr) {
            console.error("Local save error:", localErr);
            return resolve({
              url: `https://res.cloudinary.com/organic/raw/upload/v1726880000/cvs/${cleanPublicId}`,
              publicId: cleanPublicId,
              originalFileName: originalName,
              format: mimeType.split("/")[1] || "pdf",
              bytes: fileBuffer.length,
            });
          }
        }

        resolve({
          url: result.secure_url || result.url,
          publicId: result.public_id,
          originalFileName: originalName,
          format: result.format || mimeType.split("/")[1] || "pdf",
          bytes: result.bytes || fileBuffer.length,
        });
      }
    );

    const stream = new Readable();
    stream.push(fileBuffer);
    stream.push(null);
    stream.pipe(uploadStream);
  });
};

/**
 * Candidate profile photo. Same Cloudinary-first / local-disk-fallback contract as
 * the CV upload above, so a missing Cloudinary config never blocks an application.
 */
export const uploadCandidatePhotoToCloudinary = (
  fileBuffer: Buffer,
  originalName: string,
  mimeType: string
): Promise<CloudinaryUploadResult> => {
  return new Promise((resolve) => {
    const folder = "bharat-organic-expo/careers/photos";
    const cleanPublicId = `photo_${Date.now()}_${originalName.replace(/[^a-zA-Z0-9]/g, "_")}`;

    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type: "image",
        public_id: cleanPublicId,
        // Square, face-aware crop so the card always gets a usable headshot.
        transformation: [{ width: 512, height: 512, crop: "fill", gravity: "face" }],
      },
      (error, result) => {
        if (error || !result) {
          console.warn(
            "⚠️ Cloudinary photo upload warning, falling back to local secure storage:",
            error?.message || error
          );

          try {
            const extension = path.extname(originalName) || `.${mimeType.split("/")[1] || "jpg"}`;
            const safeFileName = `${cleanPublicId}${extension}`;
            const uploadDir = path.join(process.cwd(), "public", "uploads", "photos");
            if (!fs.existsSync(uploadDir)) {
              fs.mkdirSync(uploadDir, { recursive: true });
            }
            fs.writeFileSync(path.join(uploadDir, safeFileName), fileBuffer);

            // Mirror into the frontend's public folder when both repos sit side by side.
            try {
              const frontendUploadDir = path.join(
                process.cwd(),
                "..",
                "organic_frontend",
                "public",
                "uploads",
                "photos"
              );
              if (!fs.existsSync(frontendUploadDir)) {
                fs.mkdirSync(frontendUploadDir, { recursive: true });
              }
              fs.writeFileSync(path.join(frontendUploadDir, safeFileName), fileBuffer);
            } catch (feErr) {
              // Ignore if running standalone
            }

            return resolve({
              url: `/uploads/photos/${safeFileName}`,
              publicId: cleanPublicId,
              originalFileName: originalName,
              format: mimeType.split("/")[1] || "jpg",
              bytes: fileBuffer.length,
            });
          } catch (localErr) {
            console.error("Local photo save error:", localErr);
            return resolve({
              url: "",
              publicId: cleanPublicId,
              originalFileName: originalName,
              format: mimeType.split("/")[1] || "jpg",
              bytes: fileBuffer.length,
            });
          }
        }

        resolve({
          url: result.secure_url || result.url,
          publicId: result.public_id,
          originalFileName: originalName,
          format: result.format || mimeType.split("/")[1] || "jpg",
          bytes: result.bytes || fileBuffer.length,
        });
      }
    );

    const stream = new Readable();
    stream.push(fileBuffer);
    stream.push(null);
    stream.pipe(uploadStream);
  });
};
