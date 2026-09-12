import { Router } from "express";
import { createUploader } from "../../../../../middlewares/upload.middleware";
import {
  getCategoryLogistics,
  updateCategoryLogistics,
  createCategoryLogistics,
  getAllCategoryLogistics,
  getCategoryLogisticsById,
  updateCategoryLogisticsById,
  deleteCategoryLogisticsById,
} from "./categoryLogistics.controller";

const router = Router();
const upload = createUploader("category-logistics");

router.get("/", getCategoryLogistics);
router.put("/", upload.any(), updateCategoryLogistics);
router.post("/", upload.any(), createCategoryLogistics);
router.get("/all", getAllCategoryLogistics);
router.get("/:id", getCategoryLogisticsById);
router.put("/:id", upload.any(), updateCategoryLogisticsById);
router.delete("/:id", deleteCategoryLogisticsById);

export default router;
