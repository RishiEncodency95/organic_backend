import { Request, Response } from "express";
import asyncHandler from "../../../../utils/asyncHandler";
import { ApiResponse } from "../../../../utils/ApiResponse";
import {
  getAwardsStatsService,
  updateAwardsStatsService,
} from "./awardsStats.service";

export const getAwardsStats = asyncHandler(async (_req: Request, res: Response) => {
  const data = await getAwardsStatsService();
  res.status(200).json(new ApiResponse(200, "Awards Stats fetched successfully", data));
});

export const updateAwardsStats = asyncHandler(async (req: Request, res: Response) => {
  const data = await updateAwardsStatsService(req.body);
  res.status(200).json(new ApiResponse(200, "Awards Stats updated successfully", data));
});
