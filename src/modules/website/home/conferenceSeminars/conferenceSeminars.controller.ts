import { Request, Response } from "express";
import asyncHandler from "../../../../utils/asyncHandler";
import { ApiResponse } from "../../../../utils/ApiResponse";
import {
  getConferenceSeminarsService,
  updateConferenceSeminarsService,
} from "./conferenceSeminars.service";

export const getConferenceSeminars = asyncHandler(async (_req: Request, res: Response) => {
  const data = await getConferenceSeminarsService();
  res.status(200).json(new ApiResponse(200, "Conference and Seminars fetched successfully", data));
});

export const updateConferenceSeminars = asyncHandler(async (req: Request, res: Response) => {
  const data = await updateConferenceSeminarsService(req.body, req.files);
  res.status(200).json(new ApiResponse(200, "Conference and Seminars updated successfully", data));
});
