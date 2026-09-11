import { Router } from "express";
import {
  getWhyExhibitHero,
  updateWhyExhibitHero,
  createWhyExhibitHero,
  getAllWhyExhibitHero,
  getWhyExhibitHeroById,
  updateWhyExhibitHeroById,
  deleteWhyExhibitHeroById,
} from "./whyExhibitHero.controller";
import { createUploader } from "../../../../../middlewares/upload.middleware";

const router = Router();
const upload = createUploader("whyexhibithero");

const uploadFields = upload.fields([{ name: "bgImage", maxCount: 1 }]);

router.get("/", getWhyExhibitHero);
router.put("/", uploadFields, updateWhyExhibitHero);
router.post("/", uploadFields, updateWhyExhibitHero);

router.get("/list", getAllWhyExhibitHero);
router.get("/:id", getWhyExhibitHeroById);
router.put("/:id", uploadFields, updateWhyExhibitHeroById);
router.delete("/:id", deleteWhyExhibitHeroById);

export default router;
