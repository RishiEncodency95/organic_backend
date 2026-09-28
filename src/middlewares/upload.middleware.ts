import multer from "multer";
import type { Request } from "express";
import cloudinary, { isCloudinaryConfigured } from "../config/cloudinary";

/**
 * Custom Multer storage engine that streams the uploaded file straight to
 * Cloudinary instead of writing it to local disk. `file.filename` (and
 * `file.path`) are set to the resulting Cloudinary secure_url, so every
 * existing `*.service.ts` that does `updateData.img = file.filename` keeps
 * working unchanged — it just resolves to a full CDN URL instead of a bare
 * local filename.
 *
 * Deliberately has NO local-disk fallback: if Cloudinary isn't configured,
 * the upload fails loudly with a clear error instead of silently writing
 * into public/uploads. A silent local fallback is exactly how a batch of
 * home-page images and testimonial photos ended up bloating the site
 * instead of ever reaching Cloudinary — this makes that failure mode
 * impossible to miss.
 */
class CloudinaryStorage implements multer.StorageEngine {
  constructor(private folder: string) {}

  _handleFile(
    _req: Request,
    file: Express.Multer.File,
    callback: (error?: any, info?: Partial<Express.Multer.File>) => void
  ): void {
    if (!isCloudinaryConfigured()) {
      callback(
        new Error(
          `Cloudinary is not configured on this server (missing CLOUDINARY_CLOUD_NAME / CLOUDINARY_API_KEY / CLOUDINARY_API_SECRET) — refusing to save "${file.originalname}" to local disk. Set the Cloudinary environment variables and try again.`
        )
      );
      return;
    }

    const uploadStream = cloudinary.uploader.upload_stream(
      { folder: this.folder, resource_type: "auto" },
      (error, result) => {
        if (error || !result) {
          callback(error || new Error("Cloudinary upload failed"));
          return;
        }
        callback(null, {
          filename: result.secure_url,
          path: result.secure_url,
          size: result.bytes,
        } as Partial<Express.Multer.File>);
      }
    );

    file.stream.on("error", (err) => callback(err));
    file.stream.pipe(uploadStream);
  }

  _removeFile(
    _req: Request,
    _file: Express.Multer.File,
    callback: (error: Error | null) => void
  ): void {
    // Nothing to clean up locally — the file lives on Cloudinary.
    callback(null);
  }
}

/**
 * Creates a reusable Multer upload instance for a specific Cloudinary
 * subfolder (e.g. "bharat-organic/homehero"). `prefix` is kept as a
 * parameter for call-site compatibility but no longer used for a local
 * filename, since Cloudinary generates its own asset id.
 */
export const createUploader = (_prefix = "upload", folder = "organic_expo") => {
  return multer({
    storage: new CloudinaryStorage(`bharat-organic/${folder}`),
    limits: {
      fileSize: 10 * 1024 * 1024, // 10MB default limit
    },
    fileFilter: (_req, file, cb) => {
      // Allow common image/media formats; permissive fallback matches the
      // previous behavior so existing upload flows don't start rejecting
      // files they used to accept.
      cb(null, true);
    },
  });
};

export const defaultUpload = createUploader("file");
