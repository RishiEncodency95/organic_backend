import { Request, Response } from "express";
import asyncHandler from "../../../../../utils/asyncHandler";
import { ApiResponse } from "../../../../../utils/ApiResponse";
import { getMsmePmsSchemeService, updateMsmePmsSchemeService } from "./msmePmsScheme.service";

export const getMsmePmsScheme = asyncHandler(async (_req: Request, res: Response) => {
  const data = await getMsmePmsSchemeService();
  res.status(200).json(new ApiResponse(200, "MSME PMS Scheme fetched successfully", data));
});

export const updateMsmePmsScheme = asyncHandler(async (req: Request, res: Response) => {
  const data = await updateMsmePmsSchemeService(req.body);
  res.status(200).json(new ApiResponse(200, "MSME PMS Scheme updated successfully", data));
});
