import { Request, Response } from "express";
import asyncHandler from "../../../../../utils/asyncHandler";
import { ApiResponse } from "../../../../../utils/ApiResponse";
import {
  getBlogCtaService,
  updateBlogCtaService,
} from "./blogCta.service";

export const getBlogCta = asyncHandler(async (_req: Request, res: Response) => {
  const data = await getBlogCtaService();
  res.status(200).json(new ApiResponse(200, "Blog CTA fetched successfully", data));
});

export const updateBlogCta = asyncHandler(async (req: Request, res: Response) => {
  const data = await updateBlogCtaService(req.body);
  res.status(200).json(new ApiResponse(200, "Blog CTA updated successfully", data));
});
