import express from 'express';
import {
    createBlogHero,
    getBlogHeros,
    getBlogHeroById,
    updateBlogHero,
    deleteBlogHero
} from './blogHero.controller';

const router = express.Router();

router.post('/', createBlogHero);
router.get('/', getBlogHeros);
router.get('/:id', getBlogHeroById);
router.put('/:id', updateBlogHero);
router.delete('/:id', deleteBlogHero);

export default router;
