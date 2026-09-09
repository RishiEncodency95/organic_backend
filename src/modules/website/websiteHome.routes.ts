import { Router } from 'express';

// Import home page routes
import becomeSponsorRoutes from './routes/home/becomeSponsorRoutes';
import beyondExhibitionRoutes from './routes/home/beyondExhibitionRoutes';
import buyerSellerMeetRoutes from './routes/home/buyerSellerMeetRoutes';
import conferenceSeminarsRoutes from './routes/home/conferenceSeminarsRoutes';
import exploreCategoriesRoutes from './routes/home/exploreCategoriesRoutes';
import expoCategoriesRoutes from './routes/home/expoCategoriesRoutes';
import globalPlatformRoutes from './routes/home/globalPlatformRoutes';
import homeHeroRoutes from './routes/home/homeHeroRoutes';
import homeVideosRoutes from './routes/home/homeVideosRoutes';
import introductionSectionRoutes from './routes/home/introductionSectionRoutes';
import partnersAndBrandsRoutes from './routes/home/partnersAndBrandsRoutes';
import sponsorsAndAttendRoutes from './routes/home/sponsorsAndAttendRoutes';
import sponsorshipCategoriesRoutes from './routes/home/sponsorshipCategoriesRoutes';
import testimonialsCarouselRoutes from './routes/home/testimonialsCarouselRoutes';
import whyParticipateRoutes from './routes/home/whyParticipateRoutes';

const router = Router();

// Mount home page routes
router.use('/home/become-sponsor', becomeSponsorRoutes);
router.use('/home/beyond-exhibition', beyondExhibitionRoutes);
router.use('/home/buyer-seller-meet', buyerSellerMeetRoutes);
router.use('/home/conference-seminars', conferenceSeminarsRoutes);
router.use('/home/explore-categories', exploreCategoriesRoutes);
router.use('/home/expo-categories', expoCategoriesRoutes);
router.use('/home/global-platform', globalPlatformRoutes);
router.use('/home/home-hero', homeHeroRoutes);
router.use('/home/home-videos', homeVideosRoutes);
router.use('/home/introduction-section', introductionSectionRoutes);
router.use('/home/partners-brands', partnersAndBrandsRoutes);
router.use('/home/sponsors-attend', sponsorsAndAttendRoutes);
router.use('/home/sponsorship-categories', sponsorshipCategoriesRoutes);
router.use('/home/testimonials-carousel', testimonialsCarouselRoutes);
router.use('/home/why-participate', whyParticipateRoutes);

export default router;
