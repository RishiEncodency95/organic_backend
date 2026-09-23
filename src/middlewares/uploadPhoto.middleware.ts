import multer from "multer";

const storage = multer.memoryStorage();

/**
 * Candidate profile photo upload. Images only, 5 MB ceiling — the same limits the
 * careers UI enforces before it sends the file.
 */
export const uploadPhotoMiddleware = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5 MB
  },
  fileFilter: (_req, file, cb) => {
    const allowedExts = /\.(jpe?g|png|webp)$/i;
    const allowedMimes = ["image/jpeg", "image/jpg", "image/png", "image/webp"];

    // Extension and MIME type must both look right, so a renamed file cannot
    // slip through on its name alone.
    if (allowedExts.test(file.originalname) && allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Invalid image type. Only JPG, PNG and WEBP photos are allowed."));
    }
  },
});
