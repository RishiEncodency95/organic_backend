import { Request, Response } from "express";
import asyncHandler from "../../../../../utils/asyncHandler";
import { ApiResponse } from "../../../../../utils/ApiResponse";
import { getMsmeSupportSectionService, updateMsmeSupportSectionService } from "./msmeSupportSection.service";

export const getMsmeSupportSection = asyncHandler(async (_req: Request, res: Response) => {
  const data = await getMsmeSupportSectionService();
  res.status(200).json(new ApiResponse(200, "MSME Support Section fetched successfully", data));
});

export const updateMsmeSupportSection = asyncHandler(async (req: Request, res: Response) => {
  const data = await updateMsmeSupportSectionService(req.body);
  res.status(200).json(new ApiResponse(200, "MSME Support Section updated successfully", data));
});
