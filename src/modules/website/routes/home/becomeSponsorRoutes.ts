import { Router, Request, Response } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
const router = Router();
import * as becomeSponsorController from "../../controllers/home/becomeSponsorController";

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadPath = path.join(__dirname, '../../../../public/uploads/organic_expo');
        if (!fs.existsSync(uploadPath)) fs.mkdirSync(uploadPath, { recursive: true });
        cb(null, uploadPath);
    },
    filename: (req, file, cb) => {
        cb(null, `becomesponsor-${file.fieldname}-${Date.now()}${path.extname(file.originalname)}`);
    }
});

const upload = multer({
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit for image
});

const uploadFields = [
    { name: 'image', maxCount: 1 }
];

router.post('/', upload.fields(uploadFields), (req, res) => becomeSponsorController.createBecomeSponsor(req, res));
router.get('/', (req, res) => becomeSponsorController.getAllBecomeSponsor(req, res));
router.get('/:id', (req, res) => becomeSponsorController.getBecomeSponsorById(req, res));
router.put('/:id', upload.fields(uploadFields), (req, res) => becomeSponsorController.updateBecomeSponsorById(req, res));
router.delete('/:id', (req, res) => becomeSponsorController.deleteBecomeSponsorById(req, res));

export default router;
