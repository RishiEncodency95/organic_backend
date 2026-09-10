import multer from "multer";
import path from "path";
import fs from "fs";

/**
 * Creates a reusable Multer upload instance for a specific prefix and subfolder.
 * Automatically ensures upload directory exists.
 */
export const createUploader = (prefix = "upload", folder = "organic_expo") => {
  const uploadDir = path.join(process.cwd(), "public", "uploads", folder);
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }

  const storage = multer.diskStorage({
    destination: (_req, _file, cb) => {
      cb(null, uploadDir);
    },
    filename: (_req, file, cb) => {
      const sanitizedOriginalName = file.originalname.replace(/\s+/g, "-");
      const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
      const ext = path.extname(sanitizedOriginalName);
      cb(null, `${prefix}-${uniqueSuffix}${ext}`);
    },
  });

  return multer({
    storage,
    limits: {
      fileSize: 10 * 1024 * 1024, // 10MB default limit
    },
    fileFilter: (_req, file, cb) => {
      // Allow common image/media formats
      const allowedMimes = [
        "image/jpeg",
        "image/png",
        "image/webp",
        "image/gif",
        "image/svg+xml",
        "video/mp4",
        "application/pdf",
      ];
      if (allowedMimes.includes(file.mimetype) || file.mimetype.startsWith("image/")) {
        cb(null, true);
      } else {
        cb(null, true); // Permissive fallback
      }
    },
  });
};

export const defaultUpload = createUploader("file");
