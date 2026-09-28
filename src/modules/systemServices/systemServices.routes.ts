import { Router } from "express";
import {
  getServices,
  getService,
  createService,
  updateService,
  removeService,
  getSummary,
  getAccessRequirements,
  getAccessStatus,
  sendAccessOtp,
  verifyAccess,
} from "./systemServices.controller";

const router = Router();

// Access & OTP Routes
router.get("/summary", getSummary);
router.get("/access/requirements", getAccessRequirements);
router.get("/access/status", getAccessStatus);
router.post("/access/send-otp", sendAccessOtp);
router.post("/access/verify", verifyAccess);

// Public / Summary
router.get("/", getServices);

// Admin CRUD Routes
router.get("/admin", getServices);
router.get("/admin/:id", getService);
router.post("/admin", createService);
router.put("/admin/:id", updateService);
router.delete("/admin/:id", removeService);

export default router;
