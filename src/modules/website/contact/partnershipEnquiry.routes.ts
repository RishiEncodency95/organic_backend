import { Router } from "express";
import {
  submitPartnershipEnquiry,
  submitPartnerRegistration,
  submitEPromotionEnquiry,
  getAllPartnershipEnquiries,
  getPartnershipEnquiryById,
  updatePartnershipEnquiry,
  deletePartnershipEnquiry,
} from "./partnershipEnquiry.controller";
import { protect } from "../../../middlewares/auth.middleware";
import { requirePermission } from "../../../middlewares/permission.middleware";
import { enquiryLimiter } from "../../../middlewares/rateLimiter.middleware";

const router = Router();

// Website forms (public)
router.post("/", enquiryLimiter, submitPartnershipEnquiry);
router.post("/partner", enquiryLimiter, submitPartnerRegistration);
router.post("/e-promotion", enquiryLimiter, submitEPromotionEnquiry);

// Admin → Partnership Enquiries: submissions hold people's contact details, so admins only
const canView = [protect, requirePermission("perm_enquiries_view")];
const canEdit = [protect, requirePermission("perm_enquiries_reply")];
router.get("/", ...canView, getAllPartnershipEnquiries);
router.get("/:id", ...canView, getPartnershipEnquiryById);
router.put("/:id", ...canEdit, updatePartnershipEnquiry);
router.delete("/:id", ...canEdit, deletePartnershipEnquiry);

export default router;
