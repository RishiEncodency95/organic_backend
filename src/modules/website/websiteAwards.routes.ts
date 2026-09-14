import { Router } from "express";

import awardsHeroRoutes from "./awards/awardsHero/awardsHero.routes";
import awardsStatsRoutes from "./awards/awardsStats/awardsStats.routes";
import awardsAboutRoutes from "./awards/awardsAbout/awardsAbout.routes";
import awardsCategoriesRoutes from "./awards/awardsCategories/awardsCategories.routes";
import awardsGrandAwardsRoutes from "./awards/awardsGrandAwards/awardsGrandAwards.routes";
import awardsProcessRoutes from "./awards/awardsProcess/awardsProcess.routes";
import awardsCelebratingLeadersRoutes from "./awards/awardsCelebratingLeaders/awardsCelebratingLeaders.routes";
import awardsInfoColumnsRoutes from "./awards/awardsInfoColumns/awardsInfoColumns.routes";
import awardsCtaRoutes from "./awards/awardsCta/awardsCta.routes";
import awardsNominationRoutes from "./awards/awardsNomination/awardsNomination.routes";
import awardsNominationSidebarRoutes from "./awards/awardsNominationSidebar/awardsNominationSidebar.routes";

const router = Router();

router.use("/awards/hero", awardsHeroRoutes);
router.use("/awards/stats", awardsStatsRoutes);
router.use("/awards/about", awardsAboutRoutes);
router.use("/awards/categories", awardsCategoriesRoutes);
router.use("/awards/grand-awards", awardsGrandAwardsRoutes);
router.use("/awards/process", awardsProcessRoutes);
router.use("/awards/celebrating-leaders", awardsCelebratingLeadersRoutes);
router.use("/awards/info-columns", awardsInfoColumnsRoutes);
router.use("/awards/cta", awardsCtaRoutes);
router.use("/awards/nominations", awardsNominationRoutes);
router.use("/awards/nomination-sidebar", awardsNominationSidebarRoutes);

export default router;
