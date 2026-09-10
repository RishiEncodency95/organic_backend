import express from 'express';
import {
    createBlogStats,
    getBlogStatss,
    getBlogStatsById,
    updateBlogStats,
    deleteBlogStats
} from './blogStats.controller';

const router = express.Router();

router.post('/', createBlogStats);
router.get('/', getBlogStatss);
router.get('/:id', getBlogStatsById);
router.put('/:id', updateBlogStats);
router.delete('/:id', deleteBlogStats);

export default router;
