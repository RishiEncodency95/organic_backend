import { Request, Response } from "express";
import asyncHandler from "../../../../utils/asyncHandler";
import { ApiResponse } from "../../../../utils/ApiResponse";
import {
  getGlobalPlatformService,
  updateGlobalPlatformService,
} from "./globalPlatform.service";

export const getGlobalPlatform = asyncHandler(async (_req: Request, res: Response) => {
  const data = await getGlobalPlatformService();
  res.status(200).json(new ApiResponse(200, "Global Platform fetched successfully", data));
});

export const updateGlobalPlatform = asyncHandler(async (req: Request, res: Response) => {
  const data = await updateGlobalPlatformService(req.body, req.files);
  res.status(200).json(new ApiResponse(200, "Global Platform updated successfully", data));
});
