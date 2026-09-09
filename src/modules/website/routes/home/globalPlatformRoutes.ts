import { Router, Request, Response } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
const router = Router();
import * as globalPlatformController from "../../controllers/home/globalPlatformController";

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadPath = path.join(__dirname, '../../../../public/uploads/organic_expo');
        if (!fs.existsSync(uploadPath)) fs.mkdirSync(uploadPath, { recursive: true });
        cb(null, uploadPath);
    },
    filename: (req, file, cb) => {
        cb(null, `global-${file.fieldname}-${Date.now()}${path.extname(file.originalname)}`);
    }
});

const upload = multer({
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 },
});

router.post('/', upload.any(), (req, res) => globalPlatformController.createGlobalPlatform(req, res));
router.get('/', (req, res) => globalPlatformController.getAllGlobalPlatform(req, res));
router.get('/:id', (req, res) => globalPlatformController.getGlobalPlatformById(req, res));
router.put('/:id', upload.any(), (req, res) => globalPlatformController.updateGlobalPlatformById(req, res));
router.delete('/:id', (req, res) => globalPlatformController.deleteGlobalPlatformById(req, res));

export default router;
