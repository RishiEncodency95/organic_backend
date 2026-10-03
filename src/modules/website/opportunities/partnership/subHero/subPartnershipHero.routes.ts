import { Router } from "express";
import { getSubPartnershipHero, updateSubPartnershipHero } from "./subPartnershipHero.controller";

const router = Router();

// /website/opportunities/partnership/sub-hero/<slug>, e.g. .../sub-hero/hotel-stay-partner
router.get("/:slug", getSubPartnershipHero);
router.put("/:slug", updateSubPartnershipHero);

export default router;
