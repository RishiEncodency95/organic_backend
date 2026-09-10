import { Request, Response } from "express";
import asyncHandler from "../../../../../utils/asyncHandler";
import { ApiResponse } from "../../../../../utils/ApiResponse";
import {
  getAboutVenueService,
  updateAboutVenueService,
} from "./aboutVenue.service";

export const getAboutVenue = asyncHandler(async (_req: Request, res: Response) => {
  const data = await getAboutVenueService();
  res.status(200).json(new ApiResponse(200, "About Venue fetched successfully", data));
});

export const updateAboutVenue = asyncHandler(async (req: Request, res: Response) => {
  const data = await updateAboutVenueService(req.body, req.files);
  res.status(200).json(new ApiResponse(200, "About Venue updated successfully", data));
});
