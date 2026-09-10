import express from 'express';
import {
    createBlogLatest,
    getBlogLatests,
    getBlogLatestById,
    updateBlogLatest,
    deleteBlogLatest
} from './blogLatest.controller';

const router = express.Router();

router.post('/', createBlogLatest);
router.get('/', getBlogLatests);
router.get('/:id', getBlogLatestById);
router.put('/:id', updateBlogLatest);
router.delete('/:id', deleteBlogLatest);

export default router;
