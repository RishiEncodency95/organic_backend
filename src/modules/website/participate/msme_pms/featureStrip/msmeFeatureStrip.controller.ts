import { Request, Response } from "express";
import asyncHandler from "../../../../../utils/asyncHandler";
import { ApiResponse } from "../../../../../utils/ApiResponse";
import { getMsmeFeatureStripService, updateMsmeFeatureStripService } from "./msmeFeatureStrip.service";

export const getMsmeFeatureStrip = asyncHandler(async (_req: Request, res: Response) => {
  const data = await getMsmeFeatureStripService();
  res.status(200).json(new ApiResponse(200, "MSME Feature Strip fetched successfully", data));
});

export const updateMsmeFeatureStrip = asyncHandler(async (req: Request, res: Response) => {
  const data = await updateMsmeFeatureStripService(req.body);
  res.status(200).json(new ApiResponse(200, "MSME Feature Strip updated successfully", data));
});
