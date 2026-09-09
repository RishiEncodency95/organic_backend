import { Router, Request, Response } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
const router = Router();
import * as conferenceSeminarsController from "../../controllers/home/conferenceSeminarsController";

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadPath = path.join(__dirname, '../../../../public/uploads/organic_expo');
        if (!fs.existsSync(uploadPath)) fs.mkdirSync(uploadPath, { recursive: true });
        cb(null, uploadPath);
    },
    filename: (req, file, cb) => {
        cb(null, `conferenceseminars-${file.fieldname}-${Date.now()}${path.extname(file.originalname)}`);
    }
});

const upload = multer({
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit for image
});

const uploadFields = [
    { name: 'image', maxCount: 1 }
];

router.post('/', upload.fields(uploadFields), (req, res) => conferenceSeminarsController.createConferenceSeminars(req, res));
router.get('/', (req, res) => conferenceSeminarsController.getAllConferenceSeminars(req, res));
router.get('/:id', (req, res) => conferenceSeminarsController.getConferenceSeminarsById(req, res));
router.put('/:id', upload.fields(uploadFields), (req, res) => conferenceSeminarsController.updateConferenceSeminarsById(req, res));
router.delete('/:id', (req, res) => conferenceSeminarsController.deleteConferenceSeminarsById(req, res));

export default router;
