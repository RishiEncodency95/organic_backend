import express from 'express';
import AdvisoryHeroRoutes from '../../routes/website/abouts/advisory_board_member/AdvisoryHero.routes';
import ChairmanMessageRoutes from '../../routes/website/abouts/advisory_board_member/ChairmanMessage.routes';
import AdvisoryBoardGridRoutes from '../../routes/website/abouts/advisory_board_member/AdvisoryBoardGrid.routes';
import AdvisoryBoardGridMemberRoutes from '../../routes/website/abouts/advisory_board_member/AdvisoryBoardGridMember.routes';
import AdvisoryPartnerRoutes from '../../routes/website/abouts/advisory_board_member/AdvisoryPartner.routes';
import NominateBannerRoutes from '../../routes/website/abouts/advisory_board_member/NominateBanner.routes';
import WhyJoinAdvisoryRoutes from '../../routes/website/abouts/advisory_board_member/WhyJoinAdvisory.routes';

const router = express.Router();

router.use('/advisoryhero', AdvisoryHeroRoutes);
router.use('/chairmanmessage', ChairmanMessageRoutes);
router.use('/advisoryboardgrid', AdvisoryBoardGridRoutes);
router.use('/advisoryboardgridmember', AdvisoryBoardGridMemberRoutes);
router.use('/advisorypartner', AdvisoryPartnerRoutes);
router.use('/nominatebanner', NominateBannerRoutes);
router.use('/whyjoinadvisory', WhyJoinAdvisoryRoutes);

export default router;
