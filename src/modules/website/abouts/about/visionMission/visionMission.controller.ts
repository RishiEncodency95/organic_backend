import { Request, Response } from "express";
import asyncHandler from "../../../../../utils/asyncHandler";
import { ApiResponse } from "../../../../../utils/ApiResponse";
import {
  getVisionMissionService,
  updateVisionMissionService,
} from "./visionMission.service";

export const getVisionMission = asyncHandler(async (_req: Request, res: Response) => {
  const data = await getVisionMissionService();
  res.status(200).json(new ApiResponse(200, "Vision Mission fetched successfully", data));
});

export const updateVisionMission = asyncHandler(async (req: Request, res: Response) => {
  const data = await updateVisionMissionService(req.body);
  res.status(200).json(new ApiResponse(200, "Vision Mission updated successfully", data));
});
