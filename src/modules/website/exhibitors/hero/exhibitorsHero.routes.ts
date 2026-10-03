import { Router } from "express";
import { getExhibitorsHero, updateExhibitorsHero } from "./exhibitorsHero.controller";

const router = Router();

router.get("/", getExhibitorsHero);
router.put("/", updateExhibitorsHero);

export default router;
