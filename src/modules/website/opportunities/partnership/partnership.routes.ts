import { Router } from "express";
import heroRoutes from "./hero/partnershipHero.routes";
import whyRoutes from "./why/partnershipWhy.routes";
import opportunitiesRoutes from "./opportunities/partnershipOpportunities.routes";
import enquiryRoutes from "./enquiry/partnershipEnquiry.routes";

const router = Router();

router.use("/hero", heroRoutes);
router.use("/why", whyRoutes);
router.use("/opportunities", opportunitiesRoutes);
router.use("/enquiry", enquiryRoutes);

export default router;
