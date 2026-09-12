import { Router } from "express";
import heroRoutes from "./hero/buyerSellerMeetHero.routes";
import featureStripRoutes from "./feature_strip/buyerSellerMeetFeatureStrip.routes";
import aboutRoutes from "./about/buyerSellerMeetAbout.routes";
import whoCanParticipateRoutes from "./who_can_participate/buyerSellerMeetWhoCanParticipate.routes";
import whatToSourceRoutes from "./what_to_source/buyerSellerMeetWhatToSource.routes";
import whyJoinRoutes from "./why_join/buyerSellerMeetWhyJoin.routes";
import howItWorksRoutes from "./how_it_works/buyerSellerMeetHowItWorks.routes";
import connectWithRoutes from "./connect_with/buyerSellerMeetConnectWith.routes";
import ctaRoutes from "./cta/buyerSellerMeetCta.routes";

const router = Router();

router.use("/hero", heroRoutes);
router.use("/feature-strip", featureStripRoutes);
router.use("/about", aboutRoutes);
router.use("/who-can-participate", whoCanParticipateRoutes);
router.use("/what-to-source", whatToSourceRoutes);
router.use("/why-join", whyJoinRoutes);
router.use("/how-it-works", howItWorksRoutes);
router.use("/connect-with", connectWithRoutes);
router.use("/cta", ctaRoutes);

export default router;
