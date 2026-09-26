import { Router } from "express";
import {
  saveEnterpriseDetails,
  saveParticipationDetails,
  recordPaymentOrder,
  confirmPaymentAndSubmit,
  getMsmeApplication,
  getAdminMsmeApplications,
  getAdminMsmeApplicationById,
  updateMsmeReviewStatus,
} from "../modules/msme/msmeApplications.controller";
import { analyzeUdyamCertificate } from "../modules/msme/udyamVerification.controller";
import { uploadUdyamMiddleware } from "../middlewares/uploadUdyam.middleware";
import { protect } from "../middlewares/auth.middleware";

const router = Router();

// PUBLIC MSME ELIGIBILITY-CHECK APIS
router.post("/udyam/analyze", uploadUdyamMiddleware.any(), analyzeUdyamCertificate);

// PUBLIC MSME APPLICATION APIS
router.post("/applications", saveEnterpriseDetails);
router.get("/applications/:id", getMsmeApplication);
router.patch("/applications/:id/participation", saveParticipationDetails);
router.post("/applications/:id/payment-order", recordPaymentOrder);
router.post("/applications/:id/payment-confirm", confirmPaymentAndSubmit);

// ADMIN MSME APIS
router.get("/admin/applications", protect, getAdminMsmeApplications);
router.get("/admin/applications/:id", protect, getAdminMsmeApplicationById);
router.patch("/admin/applications/:id/review", protect, updateMsmeReviewStatus);

export default router;
