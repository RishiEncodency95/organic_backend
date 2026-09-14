import { Request, Response } from "express";
import asyncHandler from "../../../../utils/asyncHandler";
import { ApiResponse } from "../../../../utils/ApiResponse";
import {
  getAwardsCategoriesService,
  updateAwardsCategoriesService,
} from "./awardsCategories.service";

export const getAwardsCategories = asyncHandler(async (_req: Request, res: Response) => {
  const data = await getAwardsCategoriesService();
  res.status(200).json(new ApiResponse(200, "Awards Categories fetched successfully", data));
});

export const updateAwardsCategories = asyncHandler(async (req: Request, res: Response) => {
  const data = await updateAwardsCategoriesService(req.body);
  res.status(200).json(new ApiResponse(200, "Awards Categories updated successfully", data));
});
