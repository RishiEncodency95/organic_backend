import express from 'express';

// Import about page routes
import aboutHeroRoutes from './routes/abouts/about/aboutHeroRoutes';
import aboutStripRoutes from './routes/abouts/about/aboutStripRoutes';
import homeAboutRoutes from './routes/abouts/about/homeAboutRoutes';
import eventOverviewRoutes from './routes/abouts/about/eventOverviewRoutes';
import fourPillarsRoutes from './routes/abouts/about/fourPillarsRoutes';
import aboutVenueRoutes from './routes/abouts/about/aboutVenueRoutes';
import aboutFaqRoutes from './routes/abouts/about/aboutFaqRoutes';
import visionMissionRoutes from './routes/abouts/about/visionMissionRoutes';
import aboutOrganizerRoutes from './routes/abouts/about/aboutOrganizerRoutes';

const router = express.Router();

// Mount about page routes
router.use('/abouts/about/about-hero', aboutHeroRoutes);
router.use('/abouts/about/about-strip', aboutStripRoutes);
router.use('/abouts/about/home-about', homeAboutRoutes);
router.use('/abouts/about/event-overview', eventOverviewRoutes);
router.use('/abouts/about/four-pillars', fourPillarsRoutes);
router.use('/abouts/about/about-venue', aboutVenueRoutes);
router.use('/abouts/about/about-faq', aboutFaqRoutes);
router.use('/abouts/about/vision-mission', visionMissionRoutes);
router.use('/abouts/about/about-organizer', aboutOrganizerRoutes);

export default router;
