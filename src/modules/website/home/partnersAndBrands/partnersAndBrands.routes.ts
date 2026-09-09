import { Router } from "express";
import multer, { StorageEngine } from "multer";
import path from "path";
import fs from "fs";
import * as ctrl from "./partnersAndBrands.controller";

const router = Router();

const storage: StorageEngine = multer.diskStorage({
  destination: (_req, _file, cb) => {
    const uploadPath = path.join(__dirname, "../../../../public/uploads/organic_expo");
    if (!fs.existsSync(uploadPath)) fs.mkdirSync(uploadPath, { recursive: true });
    cb(null, uploadPath);
  },
  filename: (_req, file, cb) => {
    cb(null, `partnersbrands-${file.fieldname}-${Date.now()}${path.extname(file.originalname)}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB per image
});

router.get("/", (req, res) => ctrl.getPartnersAndBrands(req, res));

// upload.any() handles dynamic field names like industryLeadersLogos_0, knowledgeLogos_2, etc.
router.post("/", upload.any(), (req, res) => ctrl.updatePartnersAndBrands(req, res));

export default router;
