import { Router, Request, Response } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
const router = Router();
import * as exploreCategoriesController from "../../controllers/home/exploreCategoriesController";

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadPath = path.join(__dirname, '../../../../public/uploads/organic_expo');
        if (!fs.existsSync(uploadPath)) fs.mkdirSync(uploadPath, { recursive: true });
        cb(null, uploadPath);
    },
    filename: (req, file, cb) => {
        cb(null, `explorecategory-${Date.now()}${path.extname(file.originalname)}`);
    }
});

const upload = multer({
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
});

// @route   GET /api/organic/explore-categories
router.get('/', (req, res) => exploreCategoriesController.getAllCategories(req, res));

// @route   GET /api/organic/explore-categories/:id
router.get('/:id', (req, res) => exploreCategoriesController.getCategoryById(req, res));

// @route   POST /api/organic/explore-categories
router.post('/', upload.single('logo'), (req, res) => exploreCategoriesController.createCategory(req, res));

// @route   PUT /api/organic/explore-categories/:id
router.put('/:id', upload.single('logo'), (req, res) => exploreCategoriesController.updateCategory(req, res));

// @route   DELETE /api/organic/explore-categories/:id
router.delete('/:id', (req, res) => exploreCategoriesController.deleteCategory(req, res));

export default router;
