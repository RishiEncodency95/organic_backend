import { Request, Response } from "express";
import asyncHandler from "../../../../../utils/asyncHandler";
import { ApiResponse } from "../../../../../utils/ApiResponse";
import {
  getFourPillarsService,
  updateFourPillarsService,
} from "./fourPillars.service";

export const getFourPillars = asyncHandler(async (_req: Request, res: Response) => {
  const data = await getFourPillarsService();
  res.status(200).json(new ApiResponse(200, "Four Pillars fetched successfully", data));
});

export const updateFourPillars = asyncHandler(async (req: Request, res: Response) => {
  const data = await updateFourPillarsService(req.body, req.files);
  res.status(200).json(new ApiResponse(200, "Four Pillars updated successfully", data));
});
