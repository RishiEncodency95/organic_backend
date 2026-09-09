import { Router, Request, Response } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
const router = Router();
import * as homeVideosController from "../../controllers/home/homeVideosController";

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

router.post('/', upload.any(), (req, res) => homeVideosController.createVideos(req, res));
router.get('/', (req, res) => homeVideosController.getAllVideos(req, res));
router.get('/:id', (req, res) => homeVideosController.getVideosById(req, res));
router.put('/:id', upload.any(), (req, res) => homeVideosController.updateVideosById(req, res));
router.delete('/:id', (req, res) => homeVideosController.deleteVideosById(req, res));

export default router;
