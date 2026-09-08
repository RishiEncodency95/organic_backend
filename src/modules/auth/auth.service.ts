import { Admin } from "../../models/Admin.model";
import { ApiError } from "../../utils/ApiError";
import { logger } from "../../utils/logger";
import { env } from "../../config/env";
import { setCache } from "../../config/redis";
import jwt from "jsonwebtoken";
import speakeasy from "speakeasy";
import qrcode from "qrcode";
import { LoginInput } from "./auth.schema";

// ─── Token Generators ────────────────────────────────────────────────────────

const generateAccessToken = (id: string, role: string): string => {
  return jwt.sign({ id, role }, env.ACCESS_TOKEN_SECRET, {
    expiresIn: env.ACCESS_TOKEN_EXPIRE as jwt.SignOptions["expiresIn"],
  });
};

const generateRefreshToken = (id: string): string => {
  return jwt.sign({ id }, env.REFRESH_TOKEN_SECRET, {
    expiresIn: env.REFRESH_TOKEN_EXPIRE as jwt.SignOptions["expiresIn"],
  });
};

// ─── Auth Service ─────────────────────────────────────────────────────────────

export const loginService = async (data: LoginInput) => {
  const { email, password } = data;

  // Search by email, phone, or employee ID
  const admin = await Admin.findOne({
    $or: [
      { email: email.toLowerCase() },
      { phone: email },
      { employeeId: email },
    ],
  }).select("+password +twoFactorSecret");

  if (!admin) {
    throw ApiError.unauthorized("Invalid email, staff ID, or password");
  }

  // Check account status
  if (!admin.isActive) {
    throw ApiError.forbidden("Account is deactivated. Contact superadmin.");
  }

  // Check if account is locked
  if (admin.isLocked()) {
    throw ApiError.tooManyRequests("Account locked due to too many failed attempts. Try after 30 minutes.");
  }

  // Verify password
  const isPasswordValid = await admin.comparePassword(password);

  if (!isPasswordValid) {
    await admin.incrementLoginAttempts();
    throw ApiError.unauthorized("Invalid email, staff ID, or password");
  }

  // Check 2FA status
  if (admin.isTwoFactorEnabled) {
    const tempToken = jwt.sign(
      { id: admin._id, step: "2fa" },
      env.ACCESS_TOKEN_SECRET,
      { expiresIn: "5m" }
    );

    return {
      requiresTwoFactor: true,
      twoFactorSetupRequired: false,
      tempToken,
    };
  }

  // Direct login if 2FA disabled or setup pending
  await admin.resetLoginAttempts();

  const accessToken = generateAccessToken(admin._id.toString(), admin.role);
  const refreshToken = generateRefreshToken(admin._id.toString());

  logger.info(`Admin logged in: ${admin.email}`);

  return {
    requiresTwoFactor: false,
    twoFactorSetupRequired: !admin.isTwoFactorEnabled,
    accessToken,
    refreshToken,
    admin: {
      id: admin._id,
      name: admin.name,
      email: admin.email,
      role: admin.role,
    },
  };
};

export const verify2FAService = async (token: string, tempToken?: string) => {
  if (!tempToken) {
    throw ApiError.unauthorized("Temp token is required for 2FA verification");
  }

  let decoded: { id: string; step: string };
  try {
    decoded = jwt.verify(tempToken, env.ACCESS_TOKEN_SECRET) as {
      id: string;
      step: string;
    };
  } catch {
    throw ApiError.unauthorized("Invalid or expired temp token");
  }

  if (decoded.step !== "2fa") {
    throw ApiError.unauthorized("Invalid token step");
  }

  const admin = await Admin.findById(decoded.id).select("+twoFactorSecret");

  if (!admin || !admin.twoFactorSecret) {
    throw ApiError.notFound("Admin not found or 2FA secret missing");
  }

  // Verify TOTP code with Microsoft Authenticator / Google Authenticator
  const isValid = speakeasy.totp.verify({
    secret: admin.twoFactorSecret,
    encoding: "base32",
    token,
    window: 1, // 30-second window allowance for clock drift
  });

  if (!isValid) {
    throw ApiError.unauthorized("Invalid 2FA code");
  }

  await admin.resetLoginAttempts();

  const accessToken = generateAccessToken(admin._id.toString(), admin.role);
  const refreshToken = generateRefreshToken(admin._id.toString());

  logger.info(`Admin 2FA verified: ${admin.email}`);

  return {
    accessToken,
    refreshToken,
    admin: {
      id: admin._id,
      name: admin.name,
      email: admin.email,
      role: admin.role,
    },
  };
};

export const setup2FAService = async (adminId: string) => {
  const admin = await Admin.findById(adminId);
  const labelEmail = admin ? admin.email : "Staff";

  // Generate TOTP secret for Microsoft Authenticator
  const secret = speakeasy.generateSecret({
    name: `Bharat Organic Expo (${labelEmail})`,
    issuer: "Bharat Organic Expo",
    length: 32,
  });

  if (admin) {
    admin.twoFactorSecret = secret.base32;
    await admin.save();
  }

  // Generate QR Code Data URL
  const qrCodeUrl = await qrcode.toDataURL(secret.otpauth_url!);

  return {
    secret: secret.base32,
    manualKey: secret.base32,
    provisioningUri: secret.otpauth_url!,
    qrCode: qrCodeUrl,
  };
};

export const confirm2FASetupService = async (adminId: string, token: string) => {
  const admin = await Admin.findById(adminId).select("+twoFactorSecret");
  if (!admin || !admin.twoFactorSecret) {
    throw ApiError.notFound("Admin account or 2FA secret not found");
  }

  const isValid = speakeasy.totp.verify({
    secret: admin.twoFactorSecret,
    encoding: "base32",
    token,
    window: 1,
  });

  if (!isValid) throw ApiError.unauthorized("Invalid 2FA confirmation code");

  admin.isTwoFactorEnabled = true;
  await admin.save();

  const backupCodes = Array.from({ length: 4 }, () =>
    `${Math.floor(1000 + Math.random() * 9000)}-${Math.floor(1000 + Math.random() * 9000)}`
  );

  return { message: "2FA enabled successfully", backupCodes };
};

export const logoutService = async (
  accessToken: string,
  _refreshToken?: string
): Promise<void> => {
  // Blacklist token in Redis until access token expiration (15 minutes)
  await setCache(`blacklist:${accessToken}`, "1", 15 * 60);
  logger.info("Admin logged out — tokens blacklisted");
};
