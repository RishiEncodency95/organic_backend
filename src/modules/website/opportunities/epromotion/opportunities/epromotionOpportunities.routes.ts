import { Router } from "express";
import { createUploader } from "../../../../../middlewares/upload.middleware";
import {
  getEPromotionOpportunities,
  updateEPromotionOpportunities,
  createEPromotionOpportunities,
  getAllEPromotionOpportunities,
  getEPromotionOpportunitiesById,
  updateEPromotionOpportunitiesById,
  deleteEPromotionOpportunitiesById,
} from "./epromotionOpportunities.controller";

const router = Router();
const upload = createUploader("epromotion-opps");

router.get("/", getEPromotionOpportunities);
router.put("/", upload.any(), updateEPromotionOpportunities);
router.post("/", upload.any(), createEPromotionOpportunities);
router.get("/all", getAllEPromotionOpportunities);
router.get("/:id", getEPromotionOpportunitiesById);
router.put("/:id", upload.any(), updateEPromotionOpportunitiesById);
router.delete("/:id", deleteEPromotionOpportunitiesById);

export default router;
