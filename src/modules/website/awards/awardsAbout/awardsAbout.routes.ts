import { Router } from "express";
import { getAwardsAbout, updateAwardsAbout } from "./awardsAbout.controller";

const router = Router();

router.get("/", getAwardsAbout);
router.put("/", updateAwardsAbout);
router.post("/", updateAwardsAbout);

export default router;
