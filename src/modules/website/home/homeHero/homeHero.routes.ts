import { Router } from "express";
import {
  createHomeHero,
  getAllHomeHero,
  getHomeHeroById,
  updateHomeHeroById,
  deleteHomeHeroById,
} from "./homeHero.controller";
import { createUploader } from "../../../../middlewares/upload.middleware";

const router = Router();
const upload = createUploader("homehero");

router.post("/", upload.single("img"), createHomeHero);
router.get("/", getAllHomeHero);
router.get("/:id", getHomeHeroById);
router.put("/:id", upload.single("img"), updateHomeHeroById);
router.delete("/:id", deleteHomeHeroById);

export default router;
