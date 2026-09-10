import express from 'express';
import {
    createWhyJoinAdvisory,
    getWhyJoinAdvisorys,
    getWhyJoinAdvisoryById,
    updateWhyJoinAdvisory,
    deleteWhyJoinAdvisory
} from './whyJoinAdvisory.controller';

const router = express.Router();

router.post('/', createWhyJoinAdvisory);
router.get('/', getWhyJoinAdvisorys);
router.get('/:id', getWhyJoinAdvisoryById);
router.put('/:id', updateWhyJoinAdvisory);
router.delete('/:id', deleteWhyJoinAdvisory);

export default router;
