import { Router, Request, Response } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
const router = Router();
import * as whyParticipateController from './whyParticipate.controller';

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadPath = path.join(__dirname, '../../../../public/uploads/organic_expo');
        if (!fs.existsSync(uploadPath)) fs.mkdirSync(uploadPath, { recursive: true });
        cb(null, uploadPath);
    },
    filename: (req, file, cb) => {
        cb(null, `whyparticipate-${file.fieldname}-${Date.now()}${path.extname(file.originalname)}`);
    }
});

const upload = multer({
    storage: storage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit for brochure
});

const uploadFields = [
    { name: 'image', maxCount: 1 },
    { name: 'brochure', maxCount: 1 }
];

router.post('/', upload.fields(uploadFields), (req, res) => whyParticipateController.createWhyParticipate(req, res));
router.get('/', (req, res) => whyParticipateController.getAllWhyParticipate(req, res));
router.get('/:id', (req, res) => whyParticipateController.getWhyParticipateById(req, res));
router.put('/:id', upload.fields(uploadFields), (req, res) => whyParticipateController.updateWhyParticipateById(req, res));
router.delete('/:id', (req, res) => whyParticipateController.deleteWhyParticipateById(req, res));

export default router;
