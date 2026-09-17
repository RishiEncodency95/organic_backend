import { Router } from "express";
import {
  getAwardsNominationHero,
  updateAwardsNominationHero,
} from "./awardsNominationHero.controller";

const router = Router();

router.get("/", getAwardsNominationHero);
router.put("/", updateAwardsNominationHero);
router.post("/", updateAwardsNominationHero);

export default router;
