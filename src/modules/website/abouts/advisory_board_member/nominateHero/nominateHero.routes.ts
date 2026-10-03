import { Router } from "express";
import { getNominateHero, updateNominateHero } from "./nominateHero.controller";

const router = Router();

router.get("/", getNominateHero);
router.put("/", updateNominateHero);

export default router;
