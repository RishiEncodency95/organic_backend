import { Router } from "express";
import heroRoutes from "./hero/exhibitorListHero.routes";
import headerRoutes from "./header/exhibitorListHeader.routes";
import ctaRoutes from "./cta/exhibitorListCta.routes";
import listRoutes from "./list/exhibitorItem.routes";

const router = Router();

router.use("/hero", heroRoutes);
router.use("/header", headerRoutes);
router.use("/cta", ctaRoutes);
router.use("/items", listRoutes);

export default router;
