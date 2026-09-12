import { Router } from "express";
import heroRoutes from "./hero/whyExhibitHero.routes";
import statsBandRoutes from "./statsBand/whyExhibitStatsBand.routes";
import reasonsRoutes from "./reasons/whyExhibitReasons.routes";
import buyersRoutes from "./buyers/whyExhibitBuyers.routes";
import testimonialsRoutes from "./testimonials/whyExhibitTestimonials.routes";

const router = Router();

router.use("/hero", heroRoutes);
router.use("/stats-band", statsBandRoutes);
router.use("/reasons", reasonsRoutes);
router.use("/buyers", buyersRoutes);
router.use("/testimonials", testimonialsRoutes);

export default router;
