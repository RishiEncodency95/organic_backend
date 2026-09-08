import { Request, Response } from "express";
import asyncHandler from "../../utils/asyncHandler";
import { ApiResponse } from "../../utils/ApiResponse";
import {
  loginService,
  verify2FAService,
  setup2FAService,
  confirm2FASetupService,
  logoutService,
  refreshTokenService,
  forgotPasswordService,
  resetPasswordService,
} from "./auth.service";
import { env } from "../../config/env";
import jwt from "jsonwebtoken";

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
        twoFactorSetupRequired: false,
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
      refreshToken: result.refreshToken,
      twoFactorSetupRequired: result.twoFactorSetupRequired,
      requiresTwoFactor: false,
      admin: result.admin,
    })
  );
});

// POST /api/auth/verify-2fa (Can handle both login 2FA verification & post-login 2FA setup confirmation)
export const verify2FA = asyncHandler(async (req: Request, res: Response) => {
  const { token, tempToken } = req.body;

  // Case 1: Login TOTP verification with tempToken
  if (tempToken) {
    const result = await verify2FAService(token, tempToken);
    res.cookie("refreshToken", result.refreshToken, COOKIE_OPTIONS);
    res.status(200).json(
      new ApiResponse(200, "2FA verified — login successful", {
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
        admin: result.admin,
      })
    );
    return;
  }

  // Case 2: Confirmation of 2FA setup by logged-in user
  let adminId = req.user?.id;
  if (!adminId && req.headers.authorization?.startsWith("Bearer ")) {
    try {
      const decoded = jwt.verify(
        req.headers.authorization.split(" ")[1],
        env.ACCESS_TOKEN_SECRET
      ) as { id: string };
      adminId = decoded.id;
    } catch {}
  }

  if (adminId) {
    const result = await confirm2FASetupService(adminId, token);
    res.status(200).json(
      new ApiResponse(200, "2FA setup confirmed successfully", result)
    );
    return;
  }

  res.status(400).json({
    success: false,
    message: "Missing tempToken or authentication for 2FA verification",
  });
});

// GET /api/auth/setup-2fa (protected)
export const setup2FA = asyncHandler(async (req: Request, res: Response) => {
  const adminId = req.user!.id;
  const result = await setup2FAService(adminId);

  res.status(200).json(
    new ApiResponse(200, "Scan the QR code in Microsoft Authenticator", result)
  );
});

// POST /api/auth/confirm-2fa (protected)
export const confirm2FA = asyncHandler(async (req: Request, res: Response) => {
  const adminId = req.user!.id;
  const { token } = req.body;
  const result = await confirm2FASetupService(adminId, token);

  res.status(200).json(
    new ApiResponse(200, "2FA setup confirmed successfully", result)
  );
});

// POST /api/auth/refresh-token (public)
export const refreshToken = asyncHandler(async (req: Request, res: Response) => {
  const token = req.body.refreshToken || req.cookies?.refreshToken;
  const result = await refreshTokenService(token);

  res.cookie("refreshToken", result.refreshToken, COOKIE_OPTIONS);
  res.status(200).json(
    new ApiResponse(200, "Token refreshed successfully", result)
  );
});

// POST /api/auth/forgot-password (public)
export const forgotPassword = asyncHandler(async (req: Request, res: Response) => {
  const result = await forgotPasswordService(req.body.email);
  res.status(200).json(
    new ApiResponse(200, "Password reset initiated", result)
  );
});

// POST /api/auth/reset-password (public)
export const resetPassword = asyncHandler(async (req: Request, res: Response) => {
  const result = await resetPasswordService(req.body.token, req.body.newPassword);
  res.status(200).json(
    new ApiResponse(200, "Password reset successfully", result)
  );
});

// POST /api/auth/logout (protected)
export const logout = asyncHandler(async (req: Request, res: Response) => {
  const accessToken = req.headers.authorization?.split(" ")[1] || "";
  const refreshToken = req.cookies?.refreshToken || req.body?.refreshToken || "";

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
