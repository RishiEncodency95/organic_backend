import rateLimit from "express-rate-limit";
import { ApiError } from "../utils/ApiError";

// Rate limiter for login endpoint — 5 attempts per 15 minutes
export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5,
  message: new ApiError(429, "Account temporarily locked. Too many failed login attempts. Please try again in 15 minutes."),
  standardHeaders: true,
  legacyHeaders: false,
});

// Rate limiter for 2FA verification endpoint — 3 attempts per 5 minutes
export const twoFALimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 3,
  message: new ApiError(429, "Too many 2FA attempts. Try again in 5 minutes."),
  standardHeaders: true,
  legacyHeaders: false,
});

// General API limiter
export const apiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100,
  message: new ApiError(429, "Too many requests. Slow down."),
  standardHeaders: true,
  legacyHeaders: false,
});
