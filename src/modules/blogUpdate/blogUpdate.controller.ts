import { Request, Response } from "express";
import asyncHandler from "../../utils/asyncHandler";
import { ApiResponse } from "../../utils/ApiResponse";
import { revalidateWebsite } from "../../utils/revalidateWebsite";
import {
  createBlogUpdateService,
  deleteBlogUpdateService,
  listBlogUpdatesService,
  listPublicBlogUpdatesService,
  updateBlogUpdateService,
} from "./blogUpdate.service";

// GET /api/blog-updates — website: published updates in order
export const getPublicBlogUpdates = asyncHandler(async (_req: Request, res: Response) => {
  res.status(200).json(new ApiResponse(200, "Blog updates", await listPublicBlogUpdatesService()));
});

// GET /api/blog-updates/admin — every update, for the admin panel
export const getBlogUpdates = asyncHandler(async (_req: Request, res: Response) => {
  res.status(200).json(new ApiResponse(200, "Blog updates", await listBlogUpdatesService()));
});

export const createBlogUpdate = asyncHandler(async (req: Request, res: Response) => {
  const expert = await createBlogUpdateService(req.body);
  revalidateWebsite();
  res.status(201).json(new ApiResponse(201, "Update added", expert));
});

export const updateBlogUpdate = asyncHandler(async (req: Request, res: Response) => {
  const expert = await updateBlogUpdateService(String(req.params.id), req.body);
  revalidateWebsite();
  res.status(200).json(new ApiResponse(200, "Update saved", expert));
});

export const deleteBlogUpdate = asyncHandler(async (req: Request, res: Response) => {
  await deleteBlogUpdateService(String(req.params.id));
  revalidateWebsite();
  res.status(200).json(new ApiResponse(200, "Update deleted", { deleted: true }));
});
