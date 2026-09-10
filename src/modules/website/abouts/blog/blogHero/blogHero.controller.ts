import { Request, Response } from "express";
import asyncHandler from "../../../../../utils/asyncHandler";
import { ApiResponse } from "../../../../../utils/ApiResponse";
import {
  getBlogHeroService,
  updateBlogHeroService,
} from "./blogHero.service";

export const getBlogHero = asyncHandler(async (_req: Request, res: Response) => {
  const data = await getBlogHeroService();
  res.status(200).json(new ApiResponse(200, "Blog Hero fetched successfully", data));
});

export const updateBlogHero = asyncHandler(async (req: Request, res: Response) => {
  const data = await updateBlogHeroService(req.body, req.files);
  res.status(200).json(new ApiResponse(200, "Blog Hero updated successfully", data));
});
