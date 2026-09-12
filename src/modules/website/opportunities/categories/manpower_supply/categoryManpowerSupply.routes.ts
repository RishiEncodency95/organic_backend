import { Router } from "express";
import { createUploader } from "../../../../../middlewares/upload.middleware";
import {
  getCategoryManpowerSupply,
  updateCategoryManpowerSupply,
  createCategoryManpowerSupply,
  getAllCategoryManpowerSupply,
  getCategoryManpowerSupplyById,
  updateCategoryManpowerSupplyById,
  deleteCategoryManpowerSupplyById,
} from "./categoryManpowerSupply.controller";

const router = Router();
const upload = createUploader("category-manpower-supply");

router.get("/", getCategoryManpowerSupply);
router.put("/", upload.any(), updateCategoryManpowerSupply);
router.post("/", upload.any(), createCategoryManpowerSupply);
router.get("/all", getAllCategoryManpowerSupply);
router.get("/:id", getCategoryManpowerSupplyById);
router.put("/:id", upload.any(), updateCategoryManpowerSupplyById);
router.delete("/:id", deleteCategoryManpowerSupplyById);

export default router;
