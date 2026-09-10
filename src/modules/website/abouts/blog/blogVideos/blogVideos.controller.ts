import { Request, Response } from "express";
import asyncHandler from "../../../../../utils/asyncHandler";
import { ApiResponse } from "../../../../../utils/ApiResponse";
import {
  getBlogVideosService,
  updateBlogVideosService,
} from "./blogVideos.service";

export const getBlogVideos = asyncHandler(async (_req: Request, res: Response) => {
  const data = await getBlogVideosService();
  res.status(200).json(new ApiResponse(200, "Blog Videos fetched successfully", data));
});

export const updateBlogVideos = asyncHandler(async (req: Request, res: Response) => {
  const data = await updateBlogVideosService(req.body);
  res.status(200).json(new ApiResponse(200, "Blog Videos updated successfully", data));
});
