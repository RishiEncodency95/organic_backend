import { Router } from "express";
import { getAwardsStats, updateAwardsStats } from "./awardsStats.controller";

const router = Router();

router.get("/", getAwardsStats);
router.put("/", updateAwardsStats);
router.post("/", updateAwardsStats);

export default router;
