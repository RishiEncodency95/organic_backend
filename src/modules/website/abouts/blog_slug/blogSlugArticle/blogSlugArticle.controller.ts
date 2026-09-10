import { Request, Response } from "express";
import asyncHandler from "../../../../../utils/asyncHandler";
import { ApiResponse } from "../../../../../utils/ApiResponse";
import {
  getBlogSlugArticleService,
  updateBlogSlugArticleService,
} from "./blogSlugArticle.service";

export const getBlogSlugArticle = asyncHandler(async (_req: Request, res: Response) => {
  const data = await getBlogSlugArticleService();
  res.status(200).json(new ApiResponse(200, "Blog Slug Article fetched successfully", data));
});

export const updateBlogSlugArticle = asyncHandler(async (req: Request, res: Response) => {
  const data = await updateBlogSlugArticleService(req.body, req.file);
  res.status(200).json(new ApiResponse(200, "Blog Slug Article updated successfully", data));
});
