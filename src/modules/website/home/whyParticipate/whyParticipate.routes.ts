import { Router } from "express";
import {
  getWhyParticipate,
  updateWhyParticipate,
  createWhyParticipate,
  getAllWhyParticipate,
  getWhyParticipateById,
  updateWhyParticipateById,
  deleteWhyParticipateById,
} from "./whyParticipate.controller";
import { createUploader } from "../../../../middlewares/upload.middleware";

const router = Router();
const upload = createUploader("whyparticipate");

const uploadFields = upload.fields([
  { name: "image", maxCount: 1 },
  { name: "brochure", maxCount: 1 },
]);

// Single-document Home Section routes
router.get("/", getWhyParticipate);
router.put("/", uploadFields, updateWhyParticipate);
router.post("/", uploadFields, updateWhyParticipate);

// Multi-document CRUD routes (if used by id)
router.get("/list", getAllWhyParticipate);
router.get("/:id", getWhyParticipateById);
router.put("/:id", uploadFields, updateWhyParticipateById);
router.delete("/:id", deleteWhyParticipateById);

export default router;
