import express from 'express';
import {
    createAdvisoryBoardGrid,
    getAdvisoryBoardGrids,
    getAdvisoryBoardGridById,
    updateAdvisoryBoardGrid,
    deleteAdvisoryBoardGrid
} from './advisoryBoardGrid.controller';

const router = express.Router();

router.post('/', createAdvisoryBoardGrid);
router.get('/', getAdvisoryBoardGrids);
router.get('/:id', getAdvisoryBoardGridById);
router.put('/:id', updateAdvisoryBoardGrid);
router.delete('/:id', deleteAdvisoryBoardGrid);

export default router;
