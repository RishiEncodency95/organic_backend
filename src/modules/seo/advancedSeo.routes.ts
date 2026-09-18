import { Router } from "express";
import multer from "multer";
import { advancedSeoController } from "./advancedSeo.controller";

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
});

router.get("/advanced", advancedSeoController.getAdvancedSeo);
router.put("/scripts", advancedSeoController.updateScripts);
router.post("/upload-file", upload.single("file"), advancedSeoController.uploadFile);
router.delete("/file/:fileId", advancedSeoController.deleteFile);

export default router;
