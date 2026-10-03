import { Router } from "express";
import exhibitionCategoriesHeroRoutes from "./exhibition_categories/hero/exhibitionCategoriesHero.routes";

const router = Router();

// Mounted under /website → /website/exhibition-categories/hero
router.use("/exhibition-categories/hero", exhibitionCategoriesHeroRoutes);

export default router;
