import { Router } from "express";
import { createUploader } from "../../../../../middlewares/upload.middleware";
import {
  getCategoryTravel,
  updateCategoryTravel,
  createCategoryTravel,
  getAllCategoryTravel,
  getCategoryTravelById,
  updateCategoryTravelById,
  deleteCategoryTravelById,
} from "./categoryTravel.controller";

const router = Router();
const upload = createUploader("category-travel");

router.get("/", getCategoryTravel);
router.put("/", upload.any(), updateCategoryTravel);
router.post("/", upload.any(), createCategoryTravel);
router.get("/all", getAllCategoryTravel);
router.get("/:id", getCategoryTravelById);
router.put("/:id", upload.any(), updateCategoryTravelById);
router.delete("/:id", deleteCategoryTravelById);

export default router;
