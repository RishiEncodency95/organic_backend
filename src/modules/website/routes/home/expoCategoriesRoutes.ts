import { Router, Request, Response } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
const router = Router();
import * as expoCategoriesController from "../../controllers/home/expoCategoriesController";

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadPath = path.join(__dirname, '../../../../public/uploads/organic_expo');
        if (!fs.existsSync(uploadPath)) fs.mkdirSync(uploadPath, { recursive: true });
        cb(null, uploadPath);
    },
    filename: (req, file, cb) => {
        cb(null, `expocategories-${file.fieldname}-${Date.now()}${path.extname(file.originalname)}`);
    }
});

const upload = multer({
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit for image
});

router.post('/', upload.any(), (req, res) => expoCategoriesController.createExpoCategories(req, res));
router.get('/', (req, res) => expoCategoriesController.getAllExpoCategories(req, res));
router.get('/:id', (req, res) => expoCategoriesController.getExpoCategoriesById(req, res));
router.put('/:id', upload.any(), (req, res) => expoCategoriesController.updateExpoCategoriesById(req, res));
router.delete('/:id', (req, res) => expoCategoriesController.deleteExpoCategoriesById(req, res));

export default router;
