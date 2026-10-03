import rateLimit from "express-rate-limit";
import { ApiError } from "../utils/ApiError";

// Rate limiter for login endpoint — protect against brute-force DDoS
export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 30,
  message: new ApiError(429, "Too many login attempts from this network. Please try again in 15 minutes."),
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

// Website chatbot — every message costs OpenAI tokens, so this also runs in development
export const chatLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 15,
  message: new ApiError(429, "Too many messages. Please wait a minute and try again."),
  standardHeaders: true,
  legacyHeaders: false,
});

// Chatbot details form — each submit can send WhatsApp messages
export const chatLeadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10,
  message: new ApiError(429, "Too many attempts. Please try again later."),
  standardHeaders: true,
  legacyHeaders: false,
});

export const chatHistoryLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10,
  message: new ApiError(429, "Too many attempts. Please try again later."),
  standardHeaders: true,
  legacyHeaders: false,
});

// General API limiter
// Skipped outside production: locally the admin, the website's server rendering and the
// browser all call the API from the same localhost IP, so one CMS save (plus the page
// loads around it) blows through 100/min and fails with 429.
export const apiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100,
  message: new ApiError(429, "Too many requests. Slow down."),
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => process.env.NODE_ENV !== "production",
});
