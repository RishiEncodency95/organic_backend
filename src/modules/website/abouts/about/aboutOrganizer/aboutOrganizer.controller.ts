import { Request, Response } from "express";
import asyncHandler from "../../../../../utils/asyncHandler";
import { ApiResponse } from "../../../../../utils/ApiResponse";
import {
  getAboutOrganizerService,
  updateAboutOrganizerService,
} from "./aboutOrganizer.service";

export const getAboutOrganizer = asyncHandler(async (_req: Request, res: Response) => {
  const data = await getAboutOrganizerService();
  res.status(200).json(new ApiResponse(200, "About Organizer fetched successfully", data));
});

export const updateAboutOrganizer = asyncHandler(async (req: Request, res: Response) => {
  const data = await updateAboutOrganizerService(req.body, req.files);
  res.status(200).json(new ApiResponse(200, "About Organizer updated successfully", data));
});
