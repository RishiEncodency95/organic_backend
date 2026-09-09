import express from 'express';
import {
    createBlogSlugBottomBanner,
    getBlogSlugBottomBanners,
    getBlogSlugBottomBannerById,
    updateBlogSlugBottomBanner,
    deleteBlogSlugBottomBanner
} from '../../../../controllers/website/abouts/blog_slug/BlogSlugBottomBannerController';

const router = express.Router();

router.post('/', createBlogSlugBottomBanner);
router.get('/', getBlogSlugBottomBanners);
router.get('/:id', getBlogSlugBottomBannerById);
router.put('/:id', updateBlogSlugBottomBanner);
router.delete('/:id', deleteBlogSlugBottomBanner);

export default router;
