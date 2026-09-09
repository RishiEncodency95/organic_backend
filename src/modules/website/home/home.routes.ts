import { Router } from 'express';

import becomeSponsorRoutes from './becomeSponsor/becomeSponsor.routes';
import beyondExhibitionRoutes from './beyondExhibition/beyondExhibition.routes';
import buyerSellerMeetRoutes from './buyerSellerMeet/buyerSellerMeet.routes';
import conferenceSeminarsRoutes from './conferenceSeminars/conferenceSeminars.routes';
import exploreCategoriesRoutes from './exploreCategories/exploreCategories.routes';
import expoCategoriesRoutes from './expoCategories/expoCategories.routes';
import globalPlatformRoutes from './globalPlatform/globalPlatform.routes';
import homeHeroRoutes from './homeHero/homeHero.routes';
import homeVideosRoutes from './homeVideos/homeVideos.routes';
import introductionSectionRoutes from './introductionSection/introductionSection.routes';
import partnersAndBrandsRoutes from './partnersAndBrands/partnersAndBrands.routes';
import sponsorsAndAttendRoutes from './sponsorsAndAttend/sponsorsAndAttend.routes';
import sponsorshipCategoriesRoutes from './sponsorshipCategories/sponsorshipCategories.routes';
import testimonialsCarouselRoutes from './testimonialsCarousel/testimonialsCarousel.routes';
import whyParticipateRoutes from './whyParticipate/whyParticipate.routes';

const router = Router();

router.use('/become-sponsor', becomeSponsorRoutes);
router.use('/beyond-exhibition', beyondExhibitionRoutes);
router.use('/buyer-seller-meet', buyerSellerMeetRoutes);
router.use('/conference-seminars', conferenceSeminarsRoutes);
router.use('/explore-categories', exploreCategoriesRoutes);
router.use('/expo-categories', expoCategoriesRoutes);
router.use('/global-platform', globalPlatformRoutes);
router.use('/hero', homeHeroRoutes);
router.use('/videos', homeVideosRoutes);
router.use('/introduction', introductionSectionRoutes);
router.use('/partners-brands', partnersAndBrandsRoutes);
router.use('/sponsors-attend', sponsorsAndAttendRoutes);
router.use('/sponsorship-categories', sponsorshipCategoriesRoutes);
router.use('/testimonials', testimonialsCarouselRoutes);
router.use('/why-participate', whyParticipateRoutes);

export default router;
