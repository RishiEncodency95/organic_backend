import express from 'express';
import {
    createBlogSlugSidebar,
    getBlogSlugSidebars,
    getBlogSlugSidebarById,
    updateBlogSlugSidebar,
    deleteBlogSlugSidebar
} from './blogSlugSidebar.controller';

const router = express.Router();

router.post('/', createBlogSlugSidebar);
router.get('/', getBlogSlugSidebars);
router.get('/:id', getBlogSlugSidebarById);
router.put('/:id', updateBlogSlugSidebar);
router.delete('/:id', deleteBlogSlugSidebar);

export default router;
