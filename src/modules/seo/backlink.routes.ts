import { Router } from "express";
import multer from "multer";
import { backlinkController } from "./backlink.controller";
import { protect } from "../../middlewares/auth.middleware";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
});

const router = Router();

// Public/Admin Fetch & Stats
router.get("/", backlinkController.getBacklinks);
router.get("/export", backlinkController.exportExcel);

// Protected routes (Admin operations)
router.post("/create", protect, backlinkController.createBacklink);
router.post("/upload-excel", protect, upload.single("file"), backlinkController.uploadExcel);
router.delete("/:id", protect, backlinkController.deleteBacklink);

export default router;
