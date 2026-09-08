import { Request, Response } from "express";
import asyncHandler from "../../utils/asyncHandler";
import { ApiResponse } from "../../utils/ApiResponse";
import {
  loginService,
  verify2FAService,
  setup2FAService,
  logoutService,
} from "./auth.service";
import { env } from "../../config/env";

const COOKIE_OPTIONS = {
  httpOnly: true,                        // Prevent client-side JS access (XSS protection)
  secure: env.NODE_ENV === "production", // HTTPS only in production
  sameSite: "strict" as const,
  maxAge: 7 * 24 * 60 * 60 * 1000,       // 7 days
};

// POST /api/auth/login
export const login = asyncHandler(async (req: Request, res: Response) => {
  const result = await loginService(req.body);

  if (result.requiresTwoFactor) {
    res.status(200).json(
      new ApiResponse(200, "2FA required", {
        requiresTwoFactor: true,
        tempToken: result.tempToken,
      })
    );
    return;
  }

  // Set secure HTTP-only refresh token cookie
  res.cookie("refreshToken", result.refreshToken, COOKIE_OPTIONS);

  res.status(200).json(
    new ApiResponse(200, "Login successful", {
      accessToken: result.accessToken,
      admin: result.admin,
    })
  );
});

// POST /api/auth/verify-2fa
export const verify2FA = asyncHandler(async (req: Request, res: Response) => {
  const { token, tempToken } = req.body;
  const result = await verify2FAService(token, tempToken);

  res.cookie("refreshToken", result.refreshToken, COOKIE_OPTIONS);

  res.status(200).json(
    new ApiResponse(200, "2FA verified — login successful", {
      accessToken: result.accessToken,
      admin: result.admin,
    })
  );
});

// GET /api/auth/setup-2fa (protected)
export const setup2FA = asyncHandler(async (req: Request, res: Response) => {
  const adminId = req.user!.id;
  const result = await setup2FAService(adminId);

  res.status(200).json(
    new ApiResponse(200, "Scan the QR code in Microsoft Authenticator", result)
  );
});

// POST /api/auth/logout (protected)
export const logout = asyncHandler(async (req: Request, res: Response) => {
  const accessToken = req.headers.authorization?.split(" ")[1] || "";
  const refreshToken = req.cookies?.refreshToken || "";

  await logoutService(accessToken, refreshToken);

  res.clearCookie("refreshToken");

  res.status(200).json(new ApiResponse(200, "Logged out successfully", null));
});

// GET /api/auth/me (protected)
export const getMe = asyncHandler(async (req: Request, res: Response) => {
  res.status(200).json(
    new ApiResponse(200, "Current user", { user: req.user })
  );
});
