import { Request, Response } from "express";
import asyncHandler from "../../utils/asyncHandler";
import {
  listSystemServices,
  getSystemServiceById,
  createSystemService,
  updateSystemService,
  removeSystemService,
  getSystemServicesSummary,
  sendAccessWhatsAppOtp,
  verifyAccessWhatsAppOtp,
} from "./systemServices.service";

export const getServices = asyncHandler(async (_req: Request, res: Response) => {
  const data = await listSystemServices();
  res.json({ success: true, message: "System services fetched successfully.", data });
});

export const getService = asyncHandler(async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const data = await getSystemServiceById(id);
  if (!data) {
    res.status(404).json({ success: false, message: "Service not found." });
    return;
  }
  res.json({ success: true, message: "Service fetched successfully.", data });
});

export const createService = asyncHandler(async (req: Request, res: Response) => {
  const data = await createSystemService(req.body);
  res.status(201).json({ success: true, message: "Service created successfully.", data });
});

export const updateService = asyncHandler(async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const data = await updateSystemService(id, req.body);
  if (!data) {
    res.status(404).json({ success: false, message: "Service not found." });
    return;
  }
  res.json({ success: true, message: "Service updated successfully.", data });
});

export const removeService = asyncHandler(async (req: Request, res: Response) => {
  const id = req.params.id as string;
  await removeSystemService(id);
  res.json({ success: true, message: "Service deleted successfully." });
});

export const getSummary = asyncHandler(async (_req: Request, res: Response) => {
  const data = await getSystemServicesSummary();
  res.json({ success: true, message: "Summary fetched successfully.", data });
});

export const getAccessRequirements = asyncHandler(async (req: Request, res: Response) => {
  const adminUser = (req as any).user || {
    id: "admin-1",
    name: "Expo Super Admin",
    email: "admin@bharatorganicexpo.com",
    phone: "+91 9310219283",
    twoFactorEnabled: true,
  };

  res.json({
    success: true,
    data: {
      expiresInMinutes: 60,
      requiredRoles: ["self"],
      requester: {
        id: adminUser.id || adminUser._id || "admin-1",
        name: adminUser.name || "Expo Super Admin",
        email: adminUser.email || "admin@bharatorganicexpo.com",
        phone: adminUser.phone || "+91 9310219283",
        twoFactorEnabled: true,
      },
      approvers: [],
    },
  });
});

export const getAccessStatus = asyncHandler(async (_req: Request, res: Response) => {
  res.json({
    success: true,
    data: {
      valid: true,
      expiresAt: new Date(Date.now() + 24 * 3600 * 1000).toISOString(),
    },
  });
});

export const sendAccessOtp = asyncHandler(async (req: Request, res: Response) => {
  const { phone, name } = req.body;
  const targetPhone = (phone as string) || "+91 9310219283";
  const result = await sendAccessWhatsAppOtp(targetPhone, name as string);
  res.json(result);
});

export const verifyAccess = asyncHandler(async (req: Request, res: Response) => {
  const { approvals, phone, otp } = req.body;
  const inputOtp = (otp as string) || (approvals && approvals[0] ? approvals[0].code : "");
  const targetPhone = (phone as string) || "+91 9310219283";

  const result = await verifyAccessWhatsAppOtp(targetPhone, inputOtp);
  if (!result.success || !("token" in result)) {
    res.status(400).json(result);
    return;
  }

  res.json({
    success: true,
    message: "Verified successfully.",
    data: {
      token: result.token,
      expiresAt: result.expiresAt,
      expiresInMinutes: result.expiresInMinutes,
    },
  });
});
