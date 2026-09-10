import { Router } from "express";
import {
  createExploreCategory,
  getAllExploreCategories,
  getExploreCategoryById,
  updateExploreCategoryById,
  deleteExploreCategoryById,
} from "./exploreCategories.controller";
import { createUploader } from "../../../../middlewares/upload.middleware";

const router = Router();
const upload = createUploader("explorecategory");

router.post("/", upload.single("logo"), createExploreCategory);
router.get("/", getAllExploreCategories);
router.get("/:id", getExploreCategoryById);
router.put("/:id", upload.single("logo"), updateExploreCategoryById);
router.delete("/:id", deleteExploreCategoryById);

export default router;
