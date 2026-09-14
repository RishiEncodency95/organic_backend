import { Router } from "express";
import {
  submitContactEnquiry,
  getAllContactEnquiries,
  getContactEnquiryById,
  updateContactEnquiry,
  deleteContactEnquiry,
} from "./contactEnquiry.controller";

const router = Router();

router.post("/", submitContactEnquiry);
router.get("/", getAllContactEnquiries);
router.get("/:id", getContactEnquiryById);
router.put("/:id", updateContactEnquiry);
router.delete("/:id", deleteContactEnquiry);

export default router;
