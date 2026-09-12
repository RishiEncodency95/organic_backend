import { Router } from "express";
import { createUploader } from "../../../../../middlewares/upload.middleware";
import {
  getCategoryHotelStay,
  updateCategoryHotelStay,
  createCategoryHotelStay,
  getAllCategoryHotelStay,
  getCategoryHotelStayById,
  updateCategoryHotelStayById,
  deleteCategoryHotelStayById,
} from "./categoryHotelStay.controller";

const router = Router();
const upload = createUploader("category-hotel-stay");

router.get("/", getCategoryHotelStay);
router.put("/", upload.any(), updateCategoryHotelStay);
router.post("/", upload.any(), createCategoryHotelStay);
router.get("/all", getAllCategoryHotelStay);
router.get("/:id", getCategoryHotelStayById);
router.put("/:id", upload.any(), updateCategoryHotelStayById);
router.delete("/:id", deleteCategoryHotelStayById);

export default router;
