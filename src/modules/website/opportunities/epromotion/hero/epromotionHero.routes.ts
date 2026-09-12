import { Router } from "express";
import { createUploader } from "../../../../../middlewares/upload.middleware";
import {
  getEPromotionHero,
  updateEPromotionHero,
  createEPromotionHero,
  getAllEPromotionHero,
  getEPromotionHeroById,
  updateEPromotionHeroById,
  deleteEPromotionHeroById,
} from "./epromotionHero.controller";

const router = Router();
const upload = createUploader("epromotion-hero");

router.get("/", getEPromotionHero);
router.put("/", upload.any(), updateEPromotionHero);
router.post("/", upload.any(), createEPromotionHero);
router.get("/all", getAllEPromotionHero);
router.get("/:id", getEPromotionHeroById);
router.put("/:id", upload.any(), updateEPromotionHeroById);
router.delete("/:id", deleteEPromotionHeroById);

export default router;
