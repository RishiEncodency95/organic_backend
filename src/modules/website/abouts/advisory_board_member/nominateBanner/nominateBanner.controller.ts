import { Request, Response } from "express";
import asyncHandler from "../../../../../utils/asyncHandler";
import { ApiResponse } from "../../../../../utils/ApiResponse";
import {
  getNominateBannerService,
  updateNominateBannerService,
} from "./nominateBanner.service";

export const getNominateBanner = asyncHandler(async (_req: Request, res: Response) => {
  const data = await getNominateBannerService();
  res.status(200).json(new ApiResponse(200, "Nominate Banner fetched successfully", data));
});

export const updateNominateBanner = asyncHandler(async (req: Request, res: Response) => {
  const data = await updateNominateBannerService(req.body);
  res.status(200).json(new ApiResponse(200, "Nominate Banner updated successfully", data));
});
