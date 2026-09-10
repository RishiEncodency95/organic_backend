import express from 'express';
import BlogHeroRoutes from './abouts/blog/blogHero/blogHero.routes';
import BlogFeaturedRoutes from './abouts/blog/blogFeatured/blogFeatured.routes';
import BlogLatestRoutes from './abouts/blog/blogLatest/blogLatest.routes';
import BlogStatsRoutes from './abouts/blog/blogStats/blogStats.routes';
import BlogCtaRoutes from './abouts/blog/blogCta/blogCta.routes';
import BlogExpertsRoutes from './abouts/blog/blogExperts/blogExperts.routes';
import BlogReportsRoutes from './abouts/blog/blogReports/blogReports.routes';
import BlogVideosRoutes from './abouts/blog/blogVideos/blogVideos.routes';
import BlogSidebarRoutes from './abouts/blog/blogSidebar/blogSidebar.routes';

const router = express.Router();

router.use('/bloghero', BlogHeroRoutes);
router.use('/blogfeatured', BlogFeaturedRoutes);
router.use('/bloglatest', BlogLatestRoutes);
router.use('/blogstats', BlogStatsRoutes);
router.use('/blogcta', BlogCtaRoutes);
router.use('/blogexperts', BlogExpertsRoutes);
router.use('/blogreports', BlogReportsRoutes);
router.use('/blogvideos', BlogVideosRoutes);
router.use('/blogsidebar', BlogSidebarRoutes);

export default router;
