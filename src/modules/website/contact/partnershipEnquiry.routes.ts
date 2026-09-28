import { Router } from "express";
import {
  submitPartnershipEnquiry,
  getAllPartnershipEnquiries,
  getPartnershipEnquiryById,
  updatePartnershipEnquiry,
  deletePartnershipEnquiry,
} from "./partnershipEnquiry.controller";

const router = Router();

router.post("/", submitPartnershipEnquiry);
router.get("/", getAllPartnershipEnquiries);
router.get("/:id", getPartnershipEnquiryById);
router.put("/:id", updatePartnershipEnquiry);
router.delete("/:id", deletePartnershipEnquiry);

export default router;
