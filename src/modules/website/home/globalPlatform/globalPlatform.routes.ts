import { Router, Request, Response } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
const router = Router();
import * as ctrl from "./globalPlatform.controller";

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadPath = path.join(__dirname, '../../../../public/uploads/organic_expo');
        if (!fs.existsSync(uploadPath)) fs.mkdirSync(uploadPath, { recursive: true });
        cb(null, uploadPath);
    },
    filename: (req, file, cb) => {
        cb(null, `global-${file.fieldname}-${Date.now()}${path.extname(file.originalname)}`);
    }
});

const upload = multer({
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 },
});

router.get('/', (req, res) => ctrl.getGlobalPlatform(req, res));

// We accept up to 10 icons for flexibility
const uploadFields = Array.from({ length: 10 }).map((_, i) => ({ name: `icon${i}`, maxCount: 1 }));
router.post('/', upload.fields(uploadFields), (req, res) => ctrl.updateGlobalPlatform(req, res));

export default router;




