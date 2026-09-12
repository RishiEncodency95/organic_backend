import { Router } from "express";
import opportunitiesRoutes from "./opportunities/opportunities.routes";

const router = Router();

router.use("/opportunities", opportunitiesRoutes);

export default router;
