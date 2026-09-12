import { Router } from "express";
import { createUploader } from "../../../../../middlewares/upload.middleware";
import {
  getSponsorshipHero,
  updateSponsorshipHero,
  createSponsorshipHero,
  getAllSponsorshipHero,
  getSponsorshipHeroById,
  updateSponsorshipHeroById,
  deleteSponsorshipHeroById,
} from "./sponsorshipHero.controller";

const router = Router();
const upload = createUploader("sponsorship-hero");

router.get("/", getSponsorshipHero);
router.put("/", upload.any(), updateSponsorshipHero);
router.post("/", upload.any(), createSponsorshipHero);
router.get("/all", getAllSponsorshipHero);
router.get("/:id", getSponsorshipHeroById);
router.put("/:id", upload.any(), updateSponsorshipHeroById);
router.delete("/:id", deleteSponsorshipHeroById);

export default router;
