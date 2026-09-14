import { Router } from "express";
import {
  sendPhoneOtp,
  verifyPhoneOtp,
  sendEmailOtp,
  verifyEmailOtp,
} from "./verify.controller";

const router = Router();

router.post("/send-phone-otp", sendPhoneOtp);
router.post("/verify-phone-otp", verifyPhoneOtp);
router.post("/send-email-otp", sendEmailOtp);
router.post("/verify-email-otp", verifyEmailOtp);

export default router;
