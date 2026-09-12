import { Router } from "express";
import heroRoutes from "./hero/whyVisitHero.routes";
import mattersRoutes from "./matters/whyVisitMatters.routes";
import segmentsRoutes from "./segments/whyVisitSegments.routes";
import buyerSellerRoutes from "./buyerSeller/whyVisitBuyerSeller.routes";
import awardsRoutes from "./awards/whyVisitAwards.routes";
import supportRoutes from "./support/whyVisitSupport.routes";
import whoShouldRoutes from "./whoShould/whyVisitWhoShould.routes";

const router = Router();

router.use("/hero", heroRoutes);
router.use("/matters", mattersRoutes);
router.use("/segments", segmentsRoutes);
router.use("/buyer-seller", buyerSellerRoutes);
router.use("/awards", awardsRoutes);
router.use("/support", supportRoutes);
router.use("/who-should", whoShouldRoutes);

export default router;
