import { Request, Response } from "express";
import asyncHandler from "../../../../../utils/asyncHandler";
import { ApiResponse } from "../../../../../utils/ApiResponse";
import {
  getBlogStatsService,
  updateBlogStatsService,
} from "./blogStats.service";

export const getBlogStats = asyncHandler(async (_req: Request, res: Response) => {
  const data = await getBlogStatsService();
  res.status(200).json(new ApiResponse(200, "Blog Stats fetched successfully", data));
});

export const updateBlogStats = asyncHandler(async (req: Request, res: Response) => {
  const data = await updateBlogStatsService(req.body);
  res.status(200).json(new ApiResponse(200, "Blog Stats updated successfully", data));
});
