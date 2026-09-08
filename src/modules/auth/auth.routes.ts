import { Router } from "express";
import { login, verify2FA, setup2FA, logout, getMe } from "./auth.controller";
import { loginLimiter, twoFALimiter } from "../../middlewares/rateLimiter.middleware";
import { protect } from "../../middlewares/auth.middleware";
import { validateRequest } from "../../middlewares/validate.middleware";
import { loginSchema, verify2FASchema } from "./auth.schema";

const router = Router();

// Public routes
router.post("/login", loginLimiter, validateRequest(loginSchema), login);
router.post("/verify-2fa", twoFALimiter, validateRequest(verify2FASchema), verify2FA);

// Protected routes
router.use(protect); // All subsequent routes require authentication
router.get("/me", getMe);
router.get("/setup-2fa", setup2FA);
router.post("/logout", logout);

export default router;
