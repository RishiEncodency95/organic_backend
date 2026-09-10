import express from 'express';
import AdvisoryHeroRoutes from './abouts/advisory_board_member/advisoryHero/advisoryHero.routes';
import ChairmanMessageRoutes from './abouts/advisory_board_member/chairmanMessage/chairmanMessage.routes';
import AdvisoryBoardGridRoutes from './abouts/advisory_board_member/advisoryBoardGrid/advisoryBoardGrid.routes';
import AdvisoryBoardGridMemberRoutes from './abouts/advisory_board_member/advisoryBoardGridMember/advisoryBoardGridMember.routes';
import AdvisoryPartnerRoutes from './abouts/advisory_board_member/advisoryPartner/advisoryPartner.routes';
import NominateBannerRoutes from './abouts/advisory_board_member/nominateBanner/nominateBanner.routes';
import WhyJoinAdvisoryRoutes from './abouts/advisory_board_member/whyJoinAdvisory/whyJoinAdvisory.routes';

const router = express.Router();

router.use('/advisoryhero', AdvisoryHeroRoutes);
router.use('/chairmanmessage', ChairmanMessageRoutes);
router.use('/advisoryboardgrid', AdvisoryBoardGridRoutes);
router.use('/advisoryboardgridmember', AdvisoryBoardGridMemberRoutes);
router.use('/advisorypartner', AdvisoryPartnerRoutes);
router.use('/nominatebanner', NominateBannerRoutes);
router.use('/whyjoinadvisory', WhyJoinAdvisoryRoutes);

export default router;
