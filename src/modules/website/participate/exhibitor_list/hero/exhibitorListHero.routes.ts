import { Router } from "express";
import {
  getExhibitorListHero,
  updateExhibitorListHero,
  createExhibitorListHero,
  getAllExhibitorListHero,
  getExhibitorListHeroById,
  updateExhibitorListHeroById,
  deleteExhibitorListHeroById,
} from "./exhibitorListHero.controller";
import { createUploader } from "../../../../../middlewares/upload.middleware";

const router = Router();
const upload = createUploader("exhibitorlisthero");

const uploadFields = upload.fields([
  { name: "bgImage", maxCount: 1 },
  { name: "leafImage", maxCount: 1 },
]);

router.get("/", getExhibitorListHero);
router.put("/", uploadFields, updateExhibitorListHero);
router.post("/", uploadFields, updateExhibitorListHero);

router.get("/list", getAllExhibitorListHero);
router.get("/:id", getExhibitorListHeroById);
router.put("/:id", uploadFields, updateExhibitorListHeroById);
router.delete("/:id", deleteExhibitorListHeroById);

export default router;
