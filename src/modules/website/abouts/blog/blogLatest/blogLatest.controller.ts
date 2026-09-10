import { Request, Response } from "express";
import asyncHandler from "../../../../../utils/asyncHandler";
import { ApiResponse } from "../../../../../utils/ApiResponse";
import {
  getBlogLatestService,
  updateBlogLatestService,
} from "./blogLatest.service";

export const getBlogLatest = asyncHandler(async (_req: Request, res: Response) => {
  const data = await getBlogLatestService();
  res.status(200).json(new ApiResponse(200, "Blog Latest fetched successfully", data));
});

export const updateBlogLatest = asyncHandler(async (req: Request, res: Response) => {
  const data = await updateBlogLatestService(req.body);
  res.status(200).json(new ApiResponse(200, "Blog Latest updated successfully", data));
});
