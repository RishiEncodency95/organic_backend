import express from "express";
import {
    createAboutStrip,
    getAllAboutStrip,
    getAboutStripById,
    updateAboutStripById,
    deleteAboutStripById
} from './aboutStrip.controller';

const router = express.Router();

router.post('/', createAboutStrip);
router.get('/', getAllAboutStrip);
router.get('/:id', getAboutStripById);
router.put('/:id', updateAboutStripById);
router.delete('/:id', deleteAboutStripById);

export default router;
