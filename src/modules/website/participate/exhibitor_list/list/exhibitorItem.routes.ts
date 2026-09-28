import { Router, type NextFunction, type Request, type Response } from "express";
import multer from "multer";
import {
  getAllExhibitorItems,
  createExhibitorItem,
  getExhibitorItemById,
  updateExhibitorItemById,
  deleteExhibitorItemById,
  bulkCreateExhibitorItems,
} from "./exhibitorItem.controller";
import { MAX_BULK_EXHIBITOR_IMAGES } from "./exhibitorItem.service";
import { createUploader } from "../../../../../middlewares/upload.middleware";
import { ApiError } from "../../../../../utils/ApiError";

const router = Router();
const upload = createUploader("exhibitorlistitems");

const uploadFields = upload.fields([{ name: "image", maxCount: 1 }]);

// Bulk upload streams straight to Cloudinary via createUploader, which does not apply the
// admin "Max Image Upload Size" setting — only multer's 10 MB per-file safety cap.
const bulkUpload = createUploader("exhibitorlistitems", "exhibitors");
const bulkImages = (req: Request, res: Response, next: NextFunction) => {
  bulkUpload.array("images", MAX_BULK_EXHIBITOR_IMAGES)(req, res, (err: unknown) => {
    if (!err) return next();
    if (err instanceof multer.MulterError) {
      if (err.code === "LIMIT_UNEXPECTED_FILE" || err.code === "LIMIT_FILE_COUNT") {
        return next(ApiError.badRequest(`You can upload at most ${MAX_BULK_EXHIBITOR_IMAGES} images at once.`));
      }
      if (err.code === "LIMIT_FILE_SIZE") {
        return next(ApiError.badRequest("Each image must be smaller than 10 MB."));
      }
    }
    next(err);
  });
};

router.get("/", getAllExhibitorItems);
router.post("/", uploadFields, createExhibitorItem);
router.post("/bulk", bulkImages, bulkCreateExhibitorItems);

router.get("/:id", getExhibitorItemById);
router.put("/:id", uploadFields, updateExhibitorItemById);
router.delete("/:id", deleteExhibitorItemById);

export default router;
