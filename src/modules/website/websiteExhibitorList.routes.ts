import { Router } from "express";
import exhibitorListRoutes from "./participate/exhibitor_list/exhibitorList.routes";
import exhibitorsHeroRoutes from "./exhibitors/hero/exhibitorsHero.routes";

const router = Router();

// Mount exhibitor_list routes under /participate/exhibitor-list
router.use("/participate/exhibitor-list", exhibitorListRoutes);
// Hero of the /exhibitors page
router.use("/exhibitors/hero", exhibitorsHeroRoutes);

export default router;
