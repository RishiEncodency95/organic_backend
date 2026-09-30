import { NextFunction, Request, Response, Router } from "express";
import multer from "multer";
import {
  submitNomination,
  getAllNominations,
  getNominationById,
  updateNomination,
  deleteNomination,
} from "./awardsNomination.controller";
import { createUploader } from "../../../../middlewares/upload.middleware";
import { protect } from "../../../../middlewares/auth.middleware";
import { logger } from "../../../../utils/logger";

const router = Router();

// Matches what the nomination form accepts: documents and images, plus video for the media slot.
const DOC_EXT = /\.(pdf|docx?|jpe?g|png)$/i;
const MEDIA_EXT = /\.(jpe?g|png|webp|mp4|mov|webm)$/i;
const UNSUPPORTED_TYPE =
  "Unsupported file type. Use PDF, DOC, JPG or PNG (MP4 / MOV / WEBM also allowed for Images / Videos).";

const nominationUploader = createUploader("nomination", "organic_expo/nominations", {
  limits: { files: 3 },
  fileFilter: (_req, file, cb) => {
    const allowed = file.fieldname === "mediaFile" ? MEDIA_EXT : DOC_EXT;
    if (allowed.test(file.originalname)) cb(null, true);
    else cb(new Error(UNSUPPORTED_TYPE));
  },
}).fields([
  { name: "deckFile", maxCount: 1 },
  { name: "certFile", maxCount: 1 },
  { name: "mediaFile", maxCount: 1 },
]);

// Turns upload failures into a 400 the form can show, instead of a generic 500.
const nominationUploads = (req: Request, res: Response, next: NextFunction) => {
  nominationUploader(req, res, (err: unknown) => {
    if (!err) return next();
    logger.warn(`Nomination upload failed: ${(err as Error)?.message || err}`);
    const message =
      err instanceof multer.MulterError
        ? err.code === "LIMIT_FILE_SIZE"
          ? "Each file must be 10MB or smaller."
          : err.message
        : err instanceof Error && err.message === UNSUPPORTED_TYPE
        ? UNSUPPORTED_TYPE
        : "File upload failed. Please try again.";
    res.status(400).json({ success: false, statusCode: 400, message, errors: [message] });
  });
};

// Public: the website nomination form.
router.post("/", nominationUploads, submitNomination);

// Admin only: nominations carry applicants' contact details.
router.get("/", protect, getAllNominations);
router.get("/:id", protect, getNominationById);
router.patch("/:id", protect, updateNomination);
router.delete("/:id", protect, deleteNomination);

export default router;
