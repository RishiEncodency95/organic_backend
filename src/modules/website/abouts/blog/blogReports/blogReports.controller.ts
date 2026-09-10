import { Request, Response } from "express";
import asyncHandler from "../../../../../utils/asyncHandler";
import { ApiResponse } from "../../../../../utils/ApiResponse";
import {
  getBlogReportsService,
  updateBlogReportsService,
} from "./blogReports.service";

export const getBlogReports = asyncHandler(async (_req: Request, res: Response) => {
  const data = await getBlogReportsService();
  res.status(200).json(new ApiResponse(200, "Blog Reports fetched successfully", data));
});

export const updateBlogReports = asyncHandler(async (req: Request, res: Response) => {
  const data = await updateBlogReportsService(req.body);
  res.status(200).json(new ApiResponse(200, "Blog Reports updated successfully", data));
});
