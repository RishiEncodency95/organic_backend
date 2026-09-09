import express from 'express';
import {
    createBlogStats,
    getBlogStatss,
    getBlogStatsById,
    updateBlogStats,
    deleteBlogStats
} from '../../../../controllers/website/abouts/blog/BlogStatsController';

const router = express.Router();

router.post('/', createBlogStats);
router.get('/', getBlogStatss);
router.get('/:id', getBlogStatsById);
router.put('/:id', updateBlogStats);
router.delete('/:id', deleteBlogStats);

export default router;
