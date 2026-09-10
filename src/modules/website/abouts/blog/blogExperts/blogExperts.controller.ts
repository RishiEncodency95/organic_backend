import { Request, Response } from "express";
import asyncHandler from "../../../../../utils/asyncHandler";
import { ApiResponse } from "../../../../../utils/ApiResponse";
import {
  getBlogExpertsService,
  updateBlogExpertsService,
} from "./blogExperts.service";

export const getBlogExperts = asyncHandler(async (_req: Request, res: Response) => {
  const data = await getBlogExpertsService();
  res.status(200).json(new ApiResponse(200, "Blog Experts fetched successfully", data));
});

export const updateBlogExperts = asyncHandler(async (req: Request, res: Response) => {
  const data = await updateBlogExpertsService(req.body);
  res.status(200).json(new ApiResponse(200, "Blog Experts updated successfully", data));
});
