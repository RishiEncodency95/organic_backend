import { Request, Response } from "express";
import asyncHandler from "../../../../utils/asyncHandler";
import { ApiResponse } from "../../../../utils/ApiResponse";
import {
  getSponsorsAndAttendService,
  updateSponsorsAndAttendService,
} from "./sponsorsAndAttend.service";

export const getSponsorsAndAttend = asyncHandler(async (_req: Request, res: Response) => {
  const data = await getSponsorsAndAttendService();
  res.status(200).json(new ApiResponse(200, "Sponsors and Attend fetched successfully", data));
});

export const updateSponsorsAndAttend = asyncHandler(async (req: Request, res: Response) => {
  const data = await updateSponsorsAndAttendService(req.body);
  res.status(200).json(new ApiResponse(200, "Sponsors and Attend updated successfully", data));
});
