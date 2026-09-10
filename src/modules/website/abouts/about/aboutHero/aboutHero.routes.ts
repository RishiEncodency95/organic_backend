import express from "express";
import {
    createAboutHero,
    getAllAboutHero,
    getAboutHeroById,
    updateAboutHeroById,
    deleteAboutHeroById
} from './aboutHero.controller';

const router = express.Router();

router.post('/', createAboutHero);
router.get('/', getAllAboutHero);
router.get('/:id', getAboutHeroById);
router.put('/:id', updateAboutHeroById);
router.delete('/:id', deleteAboutHeroById);

export default router;
