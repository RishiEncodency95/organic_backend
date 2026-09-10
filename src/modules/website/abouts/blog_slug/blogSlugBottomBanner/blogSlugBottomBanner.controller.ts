import { Request, Response } from "express";
import asyncHandler from "../../../../../utils/asyncHandler";
import { ApiResponse } from "../../../../../utils/ApiResponse";
import {
  getBlogSlugBottomBannerService,
  updateBlogSlugBottomBannerService,
} from "./blogSlugBottomBanner.service";

export const getBlogSlugBottomBanner = asyncHandler(async (_req: Request, res: Response) => {
  const data = await getBlogSlugBottomBannerService();
  res.status(200).json(new ApiResponse(200, "Blog Slug Bottom Banner fetched successfully", data));
});

export const updateBlogSlugBottomBanner = asyncHandler(async (req: Request, res: Response) => {
  const data = await updateBlogSlugBottomBannerService(req.body);
  res.status(200).json(new ApiResponse(200, "Blog Slug Bottom Banner updated successfully", data));
});
