import { Router } from "express";
import { dashboardController } from "./dashboard.controller";

const router = Router();

router.get("/overview", dashboardController.getOverview);
router.get("/", dashboardController.getOverview);

export default router;
