import { Router } from "express";
import {
  getAwardsGrandAwards,
  updateAwardsGrandAwards,
} from "./awardsGrandAwards.controller";

const router = Router();

router.get("/", getAwardsGrandAwards);
router.put("/", updateAwardsGrandAwards);
router.post("/", updateAwardsGrandAwards);

export default router;
