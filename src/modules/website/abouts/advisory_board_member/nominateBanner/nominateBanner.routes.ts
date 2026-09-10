import express from 'express';
import {
    createNominateBanner,
    getNominateBanners,
    getNominateBannerById,
    updateNominateBanner,
    deleteNominateBanner
} from './nominateBanner.controller';

const router = express.Router();

router.post('/', createNominateBanner);
router.get('/', getNominateBanners);
router.get('/:id', getNominateBannerById);
router.put('/:id', updateNominateBanner);
router.delete('/:id', deleteNominateBanner);

export default router;
