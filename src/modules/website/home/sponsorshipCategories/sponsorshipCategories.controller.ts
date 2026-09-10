import { Request, Response } from "express";
import asyncHandler from "../../../../utils/asyncHandler";
import { ApiResponse } from "../../../../utils/ApiResponse";
import {
  getSponsorshipCategoriesService,
  updateSponsorshipCategoriesService,
} from "./sponsorshipCategories.service";

export const getSponsorshipCategories = asyncHandler(async (_req: Request, res: Response) => {
  const data = await getSponsorshipCategoriesService();
  res.status(200).json(new ApiResponse(200, "Sponsorship Categories fetched successfully", data));
});

export const updateSponsorshipCategories = asyncHandler(async (req: Request, res: Response) => {
  const data = await updateSponsorshipCategoriesService(req.body, req.files);
  res.status(200).json(new ApiResponse(200, "Sponsorship Categories updated successfully", data));
});
