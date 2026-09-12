import { Router } from 'express';

import audienceStripRoutes from './home/audienceStrip/audienceStrip.routes';
import becomeSponsorRoutes from './home/becomeSponsor/becomeSponsor.routes';
import beyondExhibitionRoutes from './home/beyondExhibition/beyondExhibition.routes';
import buyerSellerMeetRoutes from './home/buyerSellerMeet/buyerSellerMeet.routes';
import conferenceSeminarsRoutes from './home/conferenceSeminars/conferenceSeminars.routes';
import exploreCategoriesRoutes from './home/exploreCategories/exploreCategories.routes';
import expoCategoriesRoutes from './home/expoCategories/expoCategories.routes';
import globalPlatformRoutes from './home/globalPlatform/globalPlatform.routes';
import homeHeroRoutes from './home/homeHero/homeHero.routes';
import homeVideosRoutes from './home/homeVideos/homeVideos.routes';
import introductionSectionRoutes from './home/introductionSection/introductionSection.routes';
import partnersAndBrandsRoutes from './home/partnersAndBrands/partnersAndBrands.routes';
import sponsorsAndAttendRoutes from './home/sponsorsAndAttend/sponsorsAndAttend.routes';
import sponsorshipCategoriesRoutes from './home/sponsorshipCategories/sponsorshipCategories.routes';
import testimonialsCarouselRoutes from './home/testimonialsCarousel/testimonialsCarousel.routes';
import whyParticipateRoutes from './home/whyParticipate/whyParticipate.routes';

const router = Router();

// Mount home page routes
router.use('/home/audience-strip', audienceStripRoutes);
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
