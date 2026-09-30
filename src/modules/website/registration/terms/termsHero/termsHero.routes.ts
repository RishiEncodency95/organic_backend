import { Router } from "express";
import { getTermsHero, updateTermsHero } from "./termsHero.controller";

const router = Router();

router.get("/", getTermsHero);
router.put("/", updateTermsHero);
router.post("/", updateTermsHero);

export default router;
