import { Router } from "express";
import { createUploader } from "../../../../../middlewares/upload.middleware";
import {
  getPartnershipOpportunities,
  updatePartnershipOpportunities,
  createPartnershipOpportunities,
  getAllPartnershipOpportunities,
  getPartnershipOpportunitiesById,
  updatePartnershipOpportunitiesById,
  deletePartnershipOpportunitiesById,
} from "./partnershipOpportunities.controller";

const router = Router();
const upload = createUploader("partnership-opps");

router.get("/", getPartnershipOpportunities);
router.put("/", upload.any(), updatePartnershipOpportunities);
router.post("/", upload.any(), createPartnershipOpportunities);
router.get("/all", getAllPartnershipOpportunities);
router.get("/:id", getPartnershipOpportunitiesById);
router.put("/:id", upload.any(), updatePartnershipOpportunitiesById);
router.delete("/:id", deletePartnershipOpportunitiesById);

export default router;
