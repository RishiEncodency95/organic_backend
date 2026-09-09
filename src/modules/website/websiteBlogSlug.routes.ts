import express from 'express';
import BlogSlugArticleRoutes from '../../routes/website/abouts/blog_slug/BlogSlugArticle.routes';
import BlogSlugSidebarRoutes from '../../routes/website/abouts/blog_slug/BlogSlugSidebar.routes';
import BlogSlugBottomBannerRoutes from '../../routes/website/abouts/blog_slug/BlogSlugBottomBanner.routes';

const router = express.Router();

router.use('/blogslugarticle', BlogSlugArticleRoutes);
router.use('/blogslugsidebar', BlogSlugSidebarRoutes);
router.use('/blogslugbottombanner', BlogSlugBottomBannerRoutes);

export default router;
