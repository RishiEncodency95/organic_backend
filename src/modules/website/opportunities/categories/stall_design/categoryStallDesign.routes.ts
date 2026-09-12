import { Router } from "express";
import { createUploader } from "../../../../../middlewares/upload.middleware";
import {
  getCategoryStallDesign,
  updateCategoryStallDesign,
  createCategoryStallDesign,
  getAllCategoryStallDesign,
  getCategoryStallDesignById,
  updateCategoryStallDesignById,
  deleteCategoryStallDesignById,
} from "./categoryStallDesign.controller";

const router = Router();
const upload = createUploader("category-stall-design");

router.get("/", getCategoryStallDesign);
router.put("/", upload.any(), updateCategoryStallDesign);
router.post("/", upload.any(), createCategoryStallDesign);
router.get("/all", getAllCategoryStallDesign);
router.get("/:id", getCategoryStallDesignById);
router.put("/:id", upload.any(), updateCategoryStallDesignById);
router.delete("/:id", deleteCategoryStallDesignById);

export default router;
