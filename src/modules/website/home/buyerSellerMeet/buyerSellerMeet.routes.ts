import { Router, Request, Response } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
const router = Router();
import * as buyerSellerMeetController from './buyerSellerMeet.controller';

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadPath = path.join(__dirname, '../../../../public/uploads/organic_expo');
        if (!fs.existsSync(uploadPath)) fs.mkdirSync(uploadPath, { recursive: true });
        cb(null, uploadPath);
    },
    filename: (req, file, cb) => {
        cb(null, `buyersellermeet-${file.fieldname}-${Date.now()}${path.extname(file.originalname)}`);
    }
});

const upload = multer({
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
});

const uploadFields = [
    { name: 'image', maxCount: 1 }
];

router.post('/', upload.fields(uploadFields), (req, res) => buyerSellerMeetController.createBuyerSellerMeet(req, res));
router.get('/', (req, res) => buyerSellerMeetController.getAllBuyerSellerMeet(req, res));
router.get('/:id', (req, res) => buyerSellerMeetController.getBuyerSellerMeetById(req, res));
router.put('/:id', upload.fields(uploadFields), (req, res) => buyerSellerMeetController.updateBuyerSellerMeetById(req, res));
router.delete('/:id', (req, res) => buyerSellerMeetController.deleteBuyerSellerMeetById(req, res));

export default router;
