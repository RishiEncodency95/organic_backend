import { Request, Response } from "express";
import asyncHandler from "../../../../../utils/asyncHandler";
import { ApiResponse } from "../../../../../utils/ApiResponse";
import {
  getBlogFeaturedService,
  updateBlogFeaturedService,
} from "./blogFeatured.service";

export const getBlogFeatured = asyncHandler(async (_req: Request, res: Response) => {
  const data = await getBlogFeaturedService();
  res.status(200).json(new ApiResponse(200, "Blog Featured fetched successfully", data));
});

export const updateBlogFeatured = asyncHandler(async (req: Request, res: Response) => {
  const data = await updateBlogFeaturedService(req.body);
  res.status(200).json(new ApiResponse(200, "Blog Featured updated successfully", data));
});
