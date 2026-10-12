import { Request, Response } from "express";
import asyncHandler from "../../utils/asyncHandler";
import { ApiResponse } from "../../utils/ApiResponse";
import { revalidateWebsite } from "../../utils/revalidateWebsite";
import {
  createBlogExpertService,
  deleteBlogExpertService,
  listBlogExpertsService,
  listPublicBlogExpertsService,
  updateBlogExpertService,
} from "./blogExpert.service";

// GET /api/blog-experts — website: published experts in order
export const getPublicBlogExperts = asyncHandler(async (_req: Request, res: Response) => {
  res.status(200).json(new ApiResponse(200, "Blog experts", await listPublicBlogExpertsService()));
});

// GET /api/blog-experts/admin — every expert, for the admin panel
export const getBlogExperts = asyncHandler(async (_req: Request, res: Response) => {
  res.status(200).json(new ApiResponse(200, "Blog experts", await listBlogExpertsService()));
});

export const createBlogExpert = asyncHandler(async (req: Request, res: Response) => {
  const expert = await createBlogExpertService(req.body);
  revalidateWebsite();
  res.status(201).json(new ApiResponse(201, "Expert added", expert));
});

export const updateBlogExpert = asyncHandler(async (req: Request, res: Response) => {
  const expert = await updateBlogExpertService(String(req.params.id), req.body);
  revalidateWebsite();
  res.status(200).json(new ApiResponse(200, "Expert updated", expert));
});

export const deleteBlogExpert = asyncHandler(async (req: Request, res: Response) => {
  await deleteBlogExpertService(String(req.params.id));
  revalidateWebsite();
  res.status(200).json(new ApiResponse(200, "Expert deleted", { deleted: true }));
});
