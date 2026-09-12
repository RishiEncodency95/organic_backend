import { Request, Response } from "express";
import asyncHandler from "../../../../../utils/asyncHandler";
import { ApiResponse } from "../../../../../utils/ApiResponse";
import { getMsmePmsBannerService, updateMsmePmsBannerService } from "./msmePmsBanner.service";

export const getMsmePmsBanner = asyncHandler(async (_req: Request, res: Response) => {
  const data = await getMsmePmsBannerService();
  res.status(200).json(new ApiResponse(200, "MSME PMS Banner fetched successfully", data));
});

export const updateMsmePmsBanner = asyncHandler(async (req: Request, res: Response) => {
  const data = await updateMsmePmsBannerService(req.body);
  res.status(200).json(new ApiResponse(200, "MSME PMS Banner updated successfully", data));
});
