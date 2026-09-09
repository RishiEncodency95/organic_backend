import express from 'express';
import {
    createBlogSlugArticle,
    getBlogSlugArticles,
    getBlogSlugArticleById,
    updateBlogSlugArticle,
    deleteBlogSlugArticle
} from '../../../../controllers/website/abouts/blog_slug/BlogSlugArticleController';

const router = express.Router();

router.post('/', createBlogSlugArticle);
router.get('/', getBlogSlugArticles);
router.get('/:id', getBlogSlugArticleById);
router.put('/:id', updateBlogSlugArticle);
router.delete('/:id', deleteBlogSlugArticle);

export default router;
