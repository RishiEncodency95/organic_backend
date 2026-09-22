import multer from "multer";

const storage = multer.memoryStorage();

export const uploadCvMiddleware = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5 MB
  },
  fileFilter: (req, file, cb) => {
    const allowedExts = /\.(pdf|doc|docx|txt)$/i;
    if (allowedExts.test(file.originalname)) {
      cb(null, true);
    } else {
      cb(new Error("Invalid file type. Only PDF, DOC, and DOCX files are allowed."));
    }
  },
});
