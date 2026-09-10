import { Router, Request, Response } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
const router = Router();
import * as introController from './introductionSection.controller';

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadPath = path.join(__dirname, '../../../../public/uploads/organic_expo');
        if (!fs.existsSync(uploadPath)) fs.mkdirSync(uploadPath, { recursive: true });
        cb(null, uploadPath);
    },
    filename: (req, file, cb) => {
        cb(null, `intro-${Date.now()}${path.extname(file.originalname)}`);
    }
});

const upload = multer({
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 },
});

router.post('/', upload.single('image'), (req, res) => introController.createIntroduction(req, res));
router.get('/', (req, res) => introController.getAllIntroduction(req, res));
router.get('/:id', (req, res) => introController.getIntroductionById(req, res));
router.put('/:id', upload.single('image'), (req, res) => introController.updateIntroductionById(req, res));
router.delete('/:id', (req, res) => introController.deleteIntroductionById(req, res));

export default router;
