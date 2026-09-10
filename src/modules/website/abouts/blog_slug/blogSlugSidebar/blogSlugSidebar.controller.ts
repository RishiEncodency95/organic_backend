import { Request, Response } from "express";
import asyncHandler from "../../../../../utils/asyncHandler";
import { ApiResponse } from "../../../../../utils/ApiResponse";
import {
  getBlogSlugSidebarService,
  updateBlogSlugSidebarService,
} from "./blogSlugSidebar.service";

export const getBlogSlugSidebar = asyncHandler(async (_req: Request, res: Response) => {
  const data = await getBlogSlugSidebarService();
  res.status(200).json(new ApiResponse(200, "Blog Slug Sidebar fetched successfully", data));
});

export const updateBlogSlugSidebar = asyncHandler(async (req: Request, res: Response) => {
  const data = await updateBlogSlugSidebarService(req.body);
  res.status(200).json(new ApiResponse(200, "Blog Slug Sidebar updated successfully", data));
});
