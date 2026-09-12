import { Router } from "express";
import { createUploader } from "../../../../../middlewares/upload.middleware";
import {
  getPartnershipHero,
  updatePartnershipHero,
  createPartnershipHero,
  getAllPartnershipHero,
  getPartnershipHeroById,
  updatePartnershipHeroById,
  deletePartnershipHeroById,
} from "./partnershipHero.controller";

const router = Router();
const upload = createUploader("partnership-hero");

router.get("/", getPartnershipHero);
router.put("/", upload.any(), updatePartnershipHero);
router.post("/", upload.any(), createPartnershipHero);
router.get("/all", getAllPartnershipHero);
router.get("/:id", getPartnershipHeroById);
router.put("/:id", upload.any(), updatePartnershipHeroById);
router.delete("/:id", deletePartnershipHeroById);

export default router;
