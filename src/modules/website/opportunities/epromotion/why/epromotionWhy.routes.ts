import { Router } from "express";
import { createUploader } from "../../../../../middlewares/upload.middleware";
import {
  getEPromotionWhy,
  updateEPromotionWhy,
  createEPromotionWhy,
  getAllEPromotionWhy,
  getEPromotionWhyById,
  updateEPromotionWhyById,
  deleteEPromotionWhyById,
} from "./epromotionWhy.controller";

const router = Router();
const upload = createUploader("epromotion-why");

router.get("/", getEPromotionWhy);
router.put("/", upload.any(), updateEPromotionWhy);
router.post("/", upload.any(), createEPromotionWhy);
router.get("/all", getAllEPromotionWhy);
router.get("/:id", getEPromotionWhyById);
router.put("/:id", upload.any(), updateEPromotionWhyById);
router.delete("/:id", deleteEPromotionWhyById);

export default router;
