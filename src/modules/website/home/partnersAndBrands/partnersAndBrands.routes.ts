import { Router } from "express";
import {
  getPartnersAndBrands,
  updatePartnersAndBrands,
  createPartnersAndBrands,
  getAllPartnersAndBrands,
  getPartnersAndBrandsById,
  updatePartnersAndBrandsById,
  deletePartnersAndBrandsById,
} from "./partnersAndBrands.controller";
import { createUploader } from "../../../../middlewares/upload.middleware";

const router = Router();
const upload = createUploader("partnerbrand");

// Single-document Home Section routes
router.get("/", getPartnersAndBrands);
router.put("/", upload.any(), updatePartnersAndBrands);
router.post("/", upload.any(), updatePartnersAndBrands);

// Multi-document CRUD routes (if used by id)
router.get("/list", getAllPartnersAndBrands);
router.get("/:id", getPartnersAndBrandsById);
router.put("/:id", upload.any(), updatePartnersAndBrandsById);
router.delete("/:id", deletePartnersAndBrandsById);

export default router;
