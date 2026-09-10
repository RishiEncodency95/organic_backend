import express from 'express';
import {
    createAdvisoryPartner,
    getAdvisoryPartners,
    getAdvisoryPartnerById,
    updateAdvisoryPartner,
    deleteAdvisoryPartner
} from './advisoryPartner.controller';

const router = express.Router();

router.post('/', createAdvisoryPartner);
router.get('/', getAdvisoryPartners);
router.get('/:id', getAdvisoryPartnerById);
router.put('/:id', updateAdvisoryPartner);
router.delete('/:id', deleteAdvisoryPartner);

export default router;
