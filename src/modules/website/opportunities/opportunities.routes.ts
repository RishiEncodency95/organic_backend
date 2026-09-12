import { Router } from "express";
import sponsorshipRoutes from "./sponsorship/sponsorship.routes";
import epromotionRoutes from "./epromotion/epromotion.routes";
import partnershipRoutes from "./partnership/partnership.routes";
import categoriesRoutes from "./categories/categories.routes";

const router = Router();

router.use("/sponsorship", sponsorshipRoutes);
router.use("/epromotion", epromotionRoutes);
router.use("/partnership", partnershipRoutes);
router.use("/categories", categoriesRoutes);

export default router;
