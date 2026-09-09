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

const uploadFields = [
    { name: 'image', maxCount: 1 },
    { name: 'brochure', maxCount: 1 }
];

router.post('/', upload.fields(uploadFields), (req, res) => sponsorshipCategoriesController.createSponsorshipCategories(req, res));
router.get('/', (req, res) => sponsorshipCategoriesController.getAllSponsorshipCategories(req, res));
router.get('/:id', (req, res) => sponsorshipCategoriesController.getSponsorshipCategoriesById(req, res));
router.put('/:id', upload.fields(uploadFields), (req, res) => sponsorshipCategoriesController.updateSponsorshipCategoriesById(req, res));
router.delete('/:id', (req, res) => sponsorshipCategoriesController.deleteSponsorshipCategoriesById(req, res));

export default router;
