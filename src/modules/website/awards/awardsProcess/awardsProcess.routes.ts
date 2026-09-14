import { Router } from "express";
import {
  getAwardsProcess,
  updateAwardsProcess,
} from "./awardsProcess.controller";

const router = Router();

router.get("/", getAwardsProcess);
router.put("/", updateAwardsProcess);
router.post("/", updateAwardsProcess);

export default router;
