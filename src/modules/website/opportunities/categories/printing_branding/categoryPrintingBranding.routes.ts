import { Router } from "express";
import { createUploader } from "../../../../../middlewares/upload.middleware";
import {
  getCategoryPrintingBranding,
  updateCategoryPrintingBranding,
  createCategoryPrintingBranding,
  getAllCategoryPrintingBranding,
  getCategoryPrintingBrandingById,
  updateCategoryPrintingBrandingById,
  deleteCategoryPrintingBrandingById,
} from "./categoryPrintingBranding.controller";

const router = Router();
const upload = createUploader("category-printing-branding");

router.get("/", getCategoryPrintingBranding);
router.put("/", upload.any(), updateCategoryPrintingBranding);
router.post("/", upload.any(), createCategoryPrintingBranding);
router.get("/all", getAllCategoryPrintingBranding);
router.get("/:id", getCategoryPrintingBrandingById);
router.put("/:id", upload.any(), updateCategoryPrintingBrandingById);
router.delete("/:id", deleteCategoryPrintingBrandingById);

export default router;
