import express from 'express';

// Import about page routes
import aboutHeroRoutes from './abouts/about/aboutHero/aboutHero.routes';
import aboutStripRoutes from './abouts/about/aboutStrip/aboutStrip.routes';
import homeAboutRoutes from './abouts/about/homeAbout/homeAbout.routes';
import eventOverviewRoutes from './abouts/about/eventOverview/eventOverview.routes';
import fourPillarsRoutes from './abouts/about/fourPillars/fourPillars.routes';
import aboutVenueRoutes from './abouts/about/aboutVenue/aboutVenue.routes';
import aboutFaqRoutes from './abouts/about/aboutFaq/aboutFaq.routes';
import visionMissionRoutes from './abouts/about/visionMission/visionMission.routes';
import aboutOrganizerRoutes from './abouts/about/aboutOrganizer/aboutOrganizer.routes';

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
