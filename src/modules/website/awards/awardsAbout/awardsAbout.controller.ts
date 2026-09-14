import { Request, Response } from "express";
import asyncHandler from "../../../../utils/asyncHandler";
import { ApiResponse } from "../../../../utils/ApiResponse";
import {
  getAwardsAboutService,
  updateAwardsAboutService,
} from "./awardsAbout.service";

export const getAwardsAbout = asyncHandler(async (_req: Request, res: Response) => {
  const data = await getAwardsAboutService();
  res.status(200).json(new ApiResponse(200, "Awards About fetched successfully", data));
});

export const updateAwardsAbout = asyncHandler(async (req: Request, res: Response) => {
  const data = await updateAwardsAboutService(req.body);
  res.status(200).json(new ApiResponse(200, "Awards About updated successfully", data));
});
