import { Request, Response } from "express";
import asyncHandler from "../../../../utils/asyncHandler";
import { ApiResponse } from "../../../../utils/ApiResponse";
import {
  getAudienceStripService,
  updateAudienceStripService,
} from "./audienceStrip.service";

export const getAudienceStrip = asyncHandler(async (_req: Request, res: Response) => {
  const data = await getAudienceStripService();
  res.status(200).json(new ApiResponse(200, "Audience Strip fetched successfully", data));
});

export const updateAudienceStrip = asyncHandler(async (req: Request, res: Response) => {
  const data = await updateAudienceStripService(req.body);
  res.status(200).json(new ApiResponse(200, "Audience Strip updated successfully", data));
});
