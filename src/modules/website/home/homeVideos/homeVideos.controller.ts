import { Request, Response } from "express";
import asyncHandler from "../../../../utils/asyncHandler";
import { ApiResponse } from "../../../../utils/ApiResponse";
import {
  getHomeVideosService,
  updateHomeVideosService,
} from "./homeVideos.service";

export const getHomeVideos = asyncHandler(async (_req: Request, res: Response) => {
  const data = await getHomeVideosService();
  res.status(200).json(new ApiResponse(200, "Home Videos fetched successfully", data));
});

export const updateHomeVideos = asyncHandler(async (req: Request, res: Response) => {
  const data = await updateHomeVideosService(req.body, req.files);
  res.status(200).json(new ApiResponse(200, "Home Videos updated successfully", data));
});
