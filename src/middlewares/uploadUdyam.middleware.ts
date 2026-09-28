import multer from "multer";

const storage = multer.memoryStorage();

/**
 * Udyam Registration certificate upload. Accepts the official PDF (usually
 * text-selectable) or a scanned/photographed image — both are common in practice.
 */
export const uploadUdyamMiddleware = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5 MB
  },
  fileFilter: (_req, file, cb) => {
    const allowedExts = /\.(pdf|jpe?g|png)$/i;
    const allowedMimes = ["application/pdf", "image/jpeg", "image/jpg", "image/png", "application/octet-stream"];

    if (allowedExts.test(file.originalname) && allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Invalid file type. Only PDF, JPG, and PNG files are allowed."));
    }
  },
});
