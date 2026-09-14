import { Router } from "express";
import { getAwardsHero, updateAwardsHero } from "./awardsHero.controller";

const router = Router();

router.get("/", getAwardsHero);
router.put("/", updateAwardsHero);
router.post("/", updateAwardsHero);

export default router;
