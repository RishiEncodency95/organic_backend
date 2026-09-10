import { Request, Response } from "express";
import asyncHandler from "../../../../utils/asyncHandler";
import { ApiResponse } from "../../../../utils/ApiResponse";
import {
  getBecomeSponsorService,
  updateBecomeSponsorService,
} from "./becomeSponsor.service";

export const getBecomeSponsor = asyncHandler(async (_req: Request, res: Response) => {
  const data = await getBecomeSponsorService();
  res.status(200).json(new ApiResponse(200, "Become Sponsor fetched successfully", data));
});

export const updateBecomeSponsor = asyncHandler(async (req: Request, res: Response) => {
  const data = await updateBecomeSponsorService(req.body, req.files);
  res.status(200).json(new ApiResponse(200, "Become Sponsor updated successfully", data));
});
