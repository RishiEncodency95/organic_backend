import { Router } from "express";
import { createUploader } from "../../../../../middlewares/upload.middleware";
import {
  getPartnershipEnquiry,
  updatePartnershipEnquiry,
  createPartnershipEnquiry,
  getAllPartnershipEnquiry,
  getPartnershipEnquiryById,
  updatePartnershipEnquiryById,
  deletePartnershipEnquiryById,
} from "./partnershipEnquiry.controller";

const router = Router();
const upload = createUploader("partnership-enquiry");

router.get("/", getPartnershipEnquiry);
router.put("/", upload.any(), updatePartnershipEnquiry);
router.post("/", upload.any(), createPartnershipEnquiry);
router.get("/all", getAllPartnershipEnquiry);
router.get("/:id", getPartnershipEnquiryById);
router.put("/:id", upload.any(), updatePartnershipEnquiryById);
router.delete("/:id", deletePartnershipEnquiryById);

export default router;
