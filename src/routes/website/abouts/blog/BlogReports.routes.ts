import express from 'express';
import {
    createBlogReports,
    getBlogReportss,
    getBlogReportsById,
    updateBlogReports,
    deleteBlogReports
} from '../../../../controllers/website/abouts/blog/BlogReportsController';

const router = express.Router();

router.post('/', createBlogReports);
router.get('/', getBlogReportss);
router.get('/:id', getBlogReportsById);
router.put('/:id', updateBlogReports);
router.delete('/:id', deleteBlogReports);

export default router;
