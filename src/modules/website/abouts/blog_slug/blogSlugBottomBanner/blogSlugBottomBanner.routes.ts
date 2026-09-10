import express from 'express';
import {
    createBlogSlugBottomBanner,
    getBlogSlugBottomBanners,
    getBlogSlugBottomBannerById,
    updateBlogSlugBottomBanner,
    deleteBlogSlugBottomBanner
} from './blogSlugBottomBanner.controller';

const router = express.Router();

router.post('/', createBlogSlugBottomBanner);
router.get('/', getBlogSlugBottomBanners);
router.get('/:id', getBlogSlugBottomBannerById);
router.put('/:id', updateBlogSlugBottomBanner);
router.delete('/:id', deleteBlogSlugBottomBanner);

export default router;
