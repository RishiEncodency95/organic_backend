import { Router } from "express";
import heroRoutes from "./hero/sponsorshipHero.routes";
import whyRoutes from "./why/sponsorshipWhy.routes";
import packagesRoutes from "./packages/sponsorshipPackages.routes";
import bottomRoutes from "./bottom/sponsorshipBottom.routes";
import contactRoutes from "./contact/sponsorshipContact.routes";

const router = Router();

router.use("/hero", heroRoutes);
router.use("/why", whyRoutes);
router.use("/packages", packagesRoutes);
router.use("/bottom", bottomRoutes);
router.use("/contact", contactRoutes);

export default router;
