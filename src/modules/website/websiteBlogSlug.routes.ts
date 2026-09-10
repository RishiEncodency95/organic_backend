import express from 'express';
import BlogSlugArticleRoutes from './abouts/blog_slug/blogSlugArticle/blogSlugArticle.routes';
import BlogSlugSidebarRoutes from './abouts/blog_slug/blogSlugSidebar/blogSlugSidebar.routes';
import BlogSlugBottomBannerRoutes from './abouts/blog_slug/blogSlugBottomBanner/blogSlugBottomBanner.routes';

const router = express.Router();

router.use('/blogslugarticle', BlogSlugArticleRoutes);
router.use('/blogslugsidebar', BlogSlugSidebarRoutes);
router.use('/blogslugbottombanner', BlogSlugBottomBannerRoutes);

export default router;
