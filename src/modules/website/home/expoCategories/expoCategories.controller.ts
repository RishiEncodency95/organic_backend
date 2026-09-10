import { Request, Response } from "express";
import asyncHandler from "../../../../utils/asyncHandler";
import { ApiResponse } from "../../../../utils/ApiResponse";
import {
  getExpoCategoriesService,
  updateExpoCategoriesService,
} from "./expoCategories.service";

export const getExpoCategories = asyncHandler(async (_req: Request, res: Response) => {
  const data = await getExpoCategoriesService();
  res.status(200).json(new ApiResponse(200, "Expo Categories fetched successfully", data));
});

export const updateExpoCategories = asyncHandler(async (req: Request, res: Response) => {
  const data = await updateExpoCategoriesService(req.body, req.files);
  res.status(200).json(new ApiResponse(200, "Expo Categories updated successfully", data));
});
