import { Router } from "express";
import { createUploader } from "../../../../../middlewares/upload.middleware";
import {
  getEPromotionBand,
  updateEPromotionBand,
  createEPromotionBand,
  getAllEPromotionBand,
  getEPromotionBandById,
  updateEPromotionBandById,
  deleteEPromotionBandById,
} from "./epromotionBand.controller";

const router = Router();
const upload = createUploader("epromotion-band");

router.get("/", getEPromotionBand);
router.put("/", upload.any(), updateEPromotionBand);
router.post("/", upload.any(), createEPromotionBand);
router.get("/all", getAllEPromotionBand);
router.get("/:id", getEPromotionBandById);
router.put("/:id", upload.any(), updateEPromotionBandById);
router.delete("/:id", deleteEPromotionBandById);

export default router;
