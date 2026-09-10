import express from 'express';
import {
    createBlogSidebar,
    getBlogSidebars,
    getBlogSidebarById,
    updateBlogSidebar,
    deleteBlogSidebar
} from './blogSidebar.controller';

const router = express.Router();

router.post('/', createBlogSidebar);
router.get('/', getBlogSidebars);
router.get('/:id', getBlogSidebarById);
router.put('/:id', updateBlogSidebar);
router.delete('/:id', deleteBlogSidebar);

export default router;
