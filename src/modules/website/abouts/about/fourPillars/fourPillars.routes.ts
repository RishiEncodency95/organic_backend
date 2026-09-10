import express from "express";
import {
    createFourPillars,
    getAllFourPillars,
    getFourPillarsById,
    updateFourPillarsById,
    deleteFourPillarsById
} from './fourPillars.controller';

const router = express.Router();

router.post('/', createFourPillars);
router.get('/', getAllFourPillars);
router.get('/:id', getFourPillarsById);
router.put('/:id', updateFourPillarsById);
router.delete('/:id', deleteFourPillarsById);

export default router;
