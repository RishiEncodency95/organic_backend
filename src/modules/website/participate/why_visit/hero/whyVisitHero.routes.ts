import { Router } from "express";
import {
  getWhyVisitHero,
  updateWhyVisitHero,
  createWhyVisitHero,
  getAllWhyVisitHero,
  getWhyVisitHeroById,
  updateWhyVisitHeroById,
  deleteWhyVisitHeroById,
} from "./whyVisitHero.controller";

const router = Router();

router.get("/", getWhyVisitHero);
router.put("/", updateWhyVisitHero);
router.post("/", createWhyVisitHero);
router.get("/all", getAllWhyVisitHero);
router.get("/:id", getWhyVisitHeroById);
router.put("/:id", updateWhyVisitHeroById);
router.delete("/:id", deleteWhyVisitHeroById);

export default router;
