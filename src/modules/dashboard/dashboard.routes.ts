import { Router } from "express";
import { dashboardController } from "./dashboard.controller";

const router = Router();

router.get("/overview", dashboardController.getOverview);
router.get("/", dashboardController.getOverview);
router.get("/page-speed", dashboardController.getPageSpeed);
router.get("/index-coverage", dashboardController.getIndexCoverage);
router.get("/site-status", dashboardController.getSiteStatus);

export const publicAnalyticsRouter = Router();
publicAnalyticsRouter.post("/track", dashboardController.trackPageView);

export default router;
