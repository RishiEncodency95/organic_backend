import { Router } from "express";
import {
  getAwardsNominationSteps,
  updateAwardsNominationSteps,
} from "./awardsNominationSteps.controller";

const router = Router();

router.get("/", getAwardsNominationSteps);
router.put("/", updateAwardsNominationSteps);
router.post("/", updateAwardsNominationSteps);

export default router;
