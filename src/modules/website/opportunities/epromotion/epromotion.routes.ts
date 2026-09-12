import { Router } from "express";
import heroRoutes from "./hero/epromotionHero.routes";
import bandRoutes from "./band/epromotionBand.routes";
import whyRoutes from "./why/epromotionWhy.routes";
import opportunitiesRoutes from "./opportunities/epromotionOpportunities.routes";

const router = Router();

router.use("/hero", heroRoutes);
router.use("/band", bandRoutes);
router.use("/why", whyRoutes);
router.use("/opportunities", opportunitiesRoutes);

export default router;
