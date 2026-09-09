import express from 'express';
import {
    createBlogSlugSidebar,
    getBlogSlugSidebars,
    getBlogSlugSidebarById,
    updateBlogSlugSidebar,
    deleteBlogSlugSidebar
} from '../../../../controllers/website/abouts/blog_slug/BlogSlugSidebarController';

const router = express.Router();

router.post('/', createBlogSlugSidebar);
router.get('/', getBlogSlugSidebars);
router.get('/:id', getBlogSlugSidebarById);
router.put('/:id', updateBlogSlugSidebar);
router.delete('/:id', deleteBlogSlugSidebar);

export default router;
