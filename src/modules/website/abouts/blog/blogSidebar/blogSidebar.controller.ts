import { Request, Response } from "express";
import asyncHandler from "../../../../../utils/asyncHandler";
import { ApiResponse } from "../../../../../utils/ApiResponse";
import {
  getBlogSidebarService,
  updateBlogSidebarService,
} from "./blogSidebar.service";

export const getBlogSidebar = asyncHandler(async (_req: Request, res: Response) => {
  const data = await getBlogSidebarService();
  res.status(200).json(new ApiResponse(200, "Blog Sidebar fetched successfully", data));
});

export const updateBlogSidebar = asyncHandler(async (req: Request, res: Response) => {
  const data = await updateBlogSidebarService(req.body);
  res.status(200).json(new ApiResponse(200, "Blog Sidebar updated successfully", data));
});
