import { Router } from "express";
import multer from "multer";
import { uploadFile } from "./upload.controller";

const router = Router();

const storage = multer.memoryStorage();
// No file-size cap here: brochures/PDFs of any size must go through. Images are still
// limited separately by the "max image upload size" setting in upload.controller.ts.
const upload = multer({ storage });

// Single file upload accepts "file" or "image" field name
router.post("/", upload.single("file"), uploadFile);
router.post("/single", upload.single("file"), uploadFile);

export default router;
