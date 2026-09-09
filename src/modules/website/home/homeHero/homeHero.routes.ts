import { Router, Request, Response } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
const router = Router();
import * as ctrl from "./homeHero.controller";

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadPath = path.join(__dirname, '../../../../public/uploads/organic_expo');
        if (!fs.existsSync(uploadPath)) fs.mkdirSync(uploadPath, { recursive: true });
        cb(null, uploadPath);
    },
    filename: (req, file, cb) => {
        cb(null, `homehero-${Date.now()}${path.extname(file.originalname)}`);
    }
});

const upload = multer({
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
});

// @route   GET /api/organic/home-hero
router.get('/', (req, res) => ctrl.getHomeHero(req, res));

// @route   POST /api/organic/home-hero
router.post('/', upload.single('img'), (req, res) => ctrl.updateHomeHero(req, res));

export default router;




