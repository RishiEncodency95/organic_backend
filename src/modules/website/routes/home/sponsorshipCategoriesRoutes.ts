import { Router, Request, Response } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
const router = Router();
import * as sponsorshipCategoriesController from "../../controllers/home/sponsorshipCategoriesController";

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadPath = path.join(__dirname, '../../../../public/uploads/organic_expo');
        if (!fs.existsSync(uploadPath)) fs.mkdirSync(uploadPath, { recursive: true });
        cb(null, uploadPath);
    },
    filename: (req, file, cb) => {
        cb(null, `sponsorshipcategories-${file.fieldname}-${Date.now()}${path.extname(file.originalname)}`);
    }
});

const upload = multer({
    storage: storage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
});

router.get('/', (req, res) => sponsorshipCategoriesController.getSponsorshipCategories(req, res));

const uploadFields = [
    { name: 'image', maxCount: 1 },
    { name: 'brochure', maxCount: 1 }
];

router.post('/', upload.fields(uploadFields), (req, res) => sponsorshipCategoriesController.updateSponsorshipCategories(req, res));

export default router;
