import express from 'express';
import {
    createAdvisoryHero,
    getAdvisoryHeros,
    getAdvisoryHeroById,
    updateAdvisoryHero,
    deleteAdvisoryHero
} from './advisoryHero.controller';

const router = express.Router();

router.post('/', createAdvisoryHero);
router.get('/', getAdvisoryHeros);
router.get('/:id', getAdvisoryHeroById);
router.put('/:id', updateAdvisoryHero);
router.delete('/:id', deleteAdvisoryHero);

export default router;
