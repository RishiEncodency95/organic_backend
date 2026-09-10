import { Request, Response } from "express";
import asyncHandler from "../../../../../utils/asyncHandler";
import { ApiResponse } from "../../../../../utils/ApiResponse";
import {
  getEventOverviewService,
  updateEventOverviewService,
} from "./eventOverview.service";

export const getEventOverview = asyncHandler(async (_req: Request, res: Response) => {
  const data = await getEventOverviewService();
  res.status(200).json(new ApiResponse(200, "Event Overview fetched successfully", data));
});

export const updateEventOverview = asyncHandler(async (req: Request, res: Response) => {
  const data = await updateEventOverviewService(req.body);
  res.status(200).json(new ApiResponse(200, "Event Overview updated successfully", data));
});
