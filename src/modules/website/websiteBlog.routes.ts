import express from 'express';
import BlogHeroRoutes from '../../routes/website/abouts/blog/BlogHero.routes';
import BlogFeaturedRoutes from '../../routes/website/abouts/blog/BlogFeatured.routes';
import BlogLatestRoutes from '../../routes/website/abouts/blog/BlogLatest.routes';
import BlogStatsRoutes from '../../routes/website/abouts/blog/BlogStats.routes';
import BlogCtaRoutes from '../../routes/website/abouts/blog/BlogCta.routes';
import BlogExpertsRoutes from '../../routes/website/abouts/blog/BlogExperts.routes';
import BlogReportsRoutes from '../../routes/website/abouts/blog/BlogReports.routes';
import BlogVideosRoutes from '../../routes/website/abouts/blog/BlogVideos.routes';
import BlogSidebarRoutes from '../../routes/website/abouts/blog/BlogSidebar.routes';

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
