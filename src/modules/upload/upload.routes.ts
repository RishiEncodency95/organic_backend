import { Router } from "express";
import multer from "multer";
import { uploadFile } from "./upload.controller";

const router = Router();

const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: {
    fileSize: 20 * 1024 * 1024, // 20MB limit
  },
});

// Single file upload accepts "file" or "image" field name
router.post("/", upload.single("file"), uploadFile);
router.post("/single", upload.single("file"), uploadFile);

export default router;
