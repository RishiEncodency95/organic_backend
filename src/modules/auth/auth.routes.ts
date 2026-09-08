import { Router } from "express";
import {
  login,
  verify2FA,
  setup2FA,
  confirm2FA,
  refreshToken,
  forgotPassword,
  resetPassword,
  logout,
  getMe,
} from "./auth.controller";
import { loginLimiter, twoFALimiter } from "../../middlewares/rateLimiter.middleware";
import { protect } from "../../middlewares/auth.middleware";
import { validateRequest } from "../../middlewares/validate.middleware";
import {
  loginSchema,
  verify2FASchema,
  forgotPasswordSchema,
  resetPasswordSchema,
} from "./auth.schema";

const router = Router();

// ─── Public routes ────────────────────────────────────────────────────────────
router.post("/login", loginLimiter, validateRequest(loginSchema), login);
router.post("/verify-2fa", twoFALimiter, validateRequest(verify2FASchema), verify2FA);
router.post("/refresh-token", refreshToken);
router.post("/forgot-password", validateRequest(forgotPasswordSchema), forgotPassword);
router.post("/reset-password", validateRequest(resetPasswordSchema), resetPassword);

// ─── Protected routes (Requires valid JWT access token) ────────────────────────
router.use(protect);
router.get("/me", getMe);
router.get("/setup-2fa", setup2FA);
router.post("/confirm-2fa", confirm2FA);
router.post("/logout", logout);

export default router;
