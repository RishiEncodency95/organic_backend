import { Request, Response } from "express";
import asyncHandler from "../../../../utils/asyncHandler";
import { ApiResponse } from "../../../../utils/ApiResponse";
import {
  getIntroductionSectionService,
  updateIntroductionSectionService,
} from "./introductionSection.service";

export const getIntroductionSection = asyncHandler(async (_req: Request, res: Response) => {
  const data = await getIntroductionSectionService();
  res.status(200).json(new ApiResponse(200, "Introduction Section fetched successfully", data));
});

export const updateIntroductionSection = asyncHandler(async (req: Request, res: Response) => {
  const data = await updateIntroductionSectionService(req.body, req.files);
  res.status(200).json(new ApiResponse(200, "Introduction Section updated successfully", data));
});
