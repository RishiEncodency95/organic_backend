import { Router, Request, Response } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
const router = Router();
import * as homeHeroController from "../../controllers/home/homeHeroController";

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

router.post('/', upload.single('img'), (req, res) => homeHeroController.createHomeHero(req, res));
router.get('/', (req, res) => homeHeroController.getAllHomeHero(req, res));
router.get('/:id', (req, res) => homeHeroController.getHomeHeroById(req, res));
router.put('/:id', upload.single('img'), (req, res) => homeHeroController.updateHomeHeroById(req, res));
router.delete('/:id', (req, res) => homeHeroController.deleteHomeHeroById(req, res));

export default router;
