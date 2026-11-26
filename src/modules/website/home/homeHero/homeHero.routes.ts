import { Router } from "express";
import {
  createHomeHero,
  getAllHomeHero,
  syncHomeHero,
  getHomeHeroById,
  updateHomeHeroById,
  deleteHomeHeroById,
} from "./homeHero.controller";
import { createUploader } from "../../../../middlewares/upload.middleware";
import { protect } from "../../../../middlewares/auth.middleware";

const router = Router();
const upload = createUploader("homehero");

// Reads stay public (the website needs them); every write requires an admin login.
router.post("/", protect, upload.single("img"), createHomeHero);
router.get("/", getAllHomeHero);
router.put("/", protect, syncHomeHero);
router.get("/:id", getHomeHeroById);
router.put("/:id", protect, upload.single("img"), updateHomeHeroById);
router.delete("/:id", protect, deleteHomeHeroById);

export default router;
