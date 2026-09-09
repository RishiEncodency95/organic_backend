import { Router, Request, Response } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
const router = Router();
import * as ctrl from "./homeVideos.controller";

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadPath = path.join(__dirname, '../../../../public/uploads/organic_expo');
        if (!fs.existsSync(uploadPath)) fs.mkdirSync(uploadPath, { recursive: true });
        cb(null, uploadPath);
    },
    filename: (req, file, cb) => {
        cb(null, `homevideos-${file.fieldname}-${Date.now()}${path.extname(file.originalname)}`);
    }
});

const upload = multer({
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit per image
});

router.get('/', (req, res) => ctrl.getVideos(req, res));

// Use upload.any() because we have dynamic array field names like thumbnail_0, thumbnail_1, etc.
router.post('/', upload.any(), (req, res) => ctrl.updateVideos(req, res));

export default router;




