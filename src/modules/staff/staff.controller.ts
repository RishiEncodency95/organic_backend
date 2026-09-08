import { Request, Response } from "express";
import asyncHandler from "../../utils/asyncHandler";
import { ApiResponse } from "../../utils/ApiResponse";
import {
  listStaffService,
  inviteStaffService,
  updateStaffService,
  updateStaffStatusService,
} from "./staff.service";

export const getStaffList = asyncHandler(async (_req: Request, res: Response) => {
  const staff = await listStaffService();
  res.status(200).json(new ApiResponse(200, "Staff list fetched", staff));
});

export const inviteStaff = asyncHandler(async (req: Request, res: Response) => {
  const result = await inviteStaffService(req.body);
  res.status(201).json(new ApiResponse(201, "Staff account created successfully", result));
});

export const updateStaff = asyncHandler(async (req: Request, res: Response) => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const updated = await updateStaffService(id, req.body);
  res.status(200).json(new ApiResponse(200, "Staff account updated", updated));
});

export const updateStaffStatus = asyncHandler(async (req: Request, res: Response) => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const { status } = req.body;
  const updated = await updateStaffStatusService(id, status);
  res.status(200).json(new ApiResponse(200, "Staff status updated", updated));
});
