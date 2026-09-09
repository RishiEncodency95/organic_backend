import express from 'express';
import {
    createBlogVideos,
    getBlogVideoss,
    getBlogVideosById,
    updateBlogVideos,
    deleteBlogVideos
} from '../../../../controllers/website/abouts/blog/BlogVideosController';

const router = express.Router();

router.post('/', createBlogVideos);
router.get('/', getBlogVideoss);
router.get('/:id', getBlogVideosById);
router.put('/:id', updateBlogVideos);
router.delete('/:id', deleteBlogVideos);

export default router;
