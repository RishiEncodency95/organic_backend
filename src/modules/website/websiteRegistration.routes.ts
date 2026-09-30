import { Router } from "express";
import termsHeroRoutes from "./registration/terms/termsHero/termsHero.routes";

const router = Router();

// Mount registration / policy page section routes
router.use("/registration/terms/terms-hero", termsHeroRoutes);

export default router;
