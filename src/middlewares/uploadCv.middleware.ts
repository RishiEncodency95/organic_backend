import multer from "multer";

const storage = multer.memoryStorage();

export const uploadCvMiddleware = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5 MB
  },
  fileFilter: (_req, file, cb) => {
    // Only the three formats the careers UI advertises. Extension and MIME type must
    // both look right, so a renamed file cannot slip through on its name alone.
    const allowedExts = /\.(pdf|doc|docx)$/i;
    const allowedMimes = [
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/octet-stream", // some browsers send this for .doc/.docx
    ];

    if (allowedExts.test(file.originalname) && allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Invalid file type. Only PDF, DOC, and DOCX files are allowed."));
    }
  },
});
