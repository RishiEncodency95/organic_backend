import { Router } from "express";
import { protect } from "../../middlewares/auth.middleware";
import {
  createDownload,
  deleteDownload,
  downloadFile,
  getDownloads,
  getPublicDownloads,
  updateDownload,
  uploadPdf,
  viewFileAsAdmin,
} from "./download.controller";

const router = Router();

// Website (public)
router.get("/", getPublicDownloads);
router.get("/:id/file", downloadFile);

// Admin (signed in); protect runs before the upload so anonymous files never reach Cloudinary
router.get("/admin", protect, getDownloads);
router.get("/:id/admin-file", protect, viewFileAsAdmin);
router.post("/", protect, uploadPdf, createDownload);
router.put("/:id", protect, uploadPdf, updateDownload);
router.patch("/:id", protect, uploadPdf, updateDownload);
router.delete("/:id", protect, deleteDownload);

export default router;
