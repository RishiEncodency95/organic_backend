import express from 'express';
import {
    createBlogExperts,
    getBlogExpertss,
    getBlogExpertsById,
    updateBlogExperts,
    deleteBlogExperts
} from '../../../../controllers/website/abouts/blog/BlogExpertsController';

const router = express.Router();

router.post('/', createBlogExperts);
router.get('/', getBlogExpertss);
router.get('/:id', getBlogExpertsById);
router.put('/:id', updateBlogExperts);
router.delete('/:id', deleteBlogExperts);

export default router;
