import { Router } from "express";
import {
  getExhibitionCategoriesHero,
  updateExhibitionCategoriesHero,
} from "./exhibitionCategoriesHero.controller";

const router = Router();

router.get("/", getExhibitionCategoriesHero);
router.put("/", updateExhibitionCategoriesHero);

export default router;
