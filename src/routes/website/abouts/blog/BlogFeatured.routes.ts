import express from 'express';
import {
    createBlogFeatured,
    getBlogFeatureds,
    getBlogFeaturedById,
    updateBlogFeatured,
    deleteBlogFeatured
} from '../../../../controllers/website/abouts/blog/BlogFeaturedController';

const router = express.Router();

router.post('/', createBlogFeatured);
router.get('/', getBlogFeatureds);
router.get('/:id', getBlogFeaturedById);
router.put('/:id', updateBlogFeatured);
router.delete('/:id', deleteBlogFeatured);

export default router;
