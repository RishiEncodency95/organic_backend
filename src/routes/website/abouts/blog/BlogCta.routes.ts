import express from 'express';
import {
    createBlogCta,
    getBlogCtas,
    getBlogCtaById,
    updateBlogCta,
    deleteBlogCta
} from '../../../../controllers/website/abouts/blog/BlogCtaController';

const router = express.Router();

router.post('/', createBlogCta);
router.get('/', getBlogCtas);
router.get('/:id', getBlogCtaById);
router.put('/:id', updateBlogCta);
router.delete('/:id', deleteBlogCta);

export default router;
