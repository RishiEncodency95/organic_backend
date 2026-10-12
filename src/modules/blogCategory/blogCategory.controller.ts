import { Request, Response } from "express";
import asyncHandler from "../../utils/asyncHandler";
import { ApiResponse } from "../../utils/ApiResponse";
import { revalidateWebsite } from "../../utils/revalidateWebsite";
import {
  createBlogCategoryService,
  deleteBlogCategoryService,
  listBlogCategoriesService,
  listPublicBlogCategoriesService,
  updateBlogCategoryService,
} from "./blogCategory.service";

// GET /api/blog-categories — website: published categories with their live post counts
export const getPublicBlogCategories = asyncHandler(async (_req: Request, res: Response) => {
  res.status(200).json(new ApiResponse(200, "Blog categories", await listPublicBlogCategoriesService()));
});

// GET /api/blog-categories/admin — every category, for the admin panel
export const getBlogCategories = asyncHandler(async (_req: Request, res: Response) => {
  res.status(200).json(new ApiResponse(200, "Blog categories", await listBlogCategoriesService()));
});

export const createBlogCategory = asyncHandler(async (req: Request, res: Response) => {
  const category = await createBlogCategoryService(req.body);
  revalidateWebsite();
  res.status(201).json(new ApiResponse(201, "Category created", category));
});

export const updateBlogCategory = asyncHandler(async (req: Request, res: Response) => {
  const category = await updateBlogCategoryService(String(req.params.id), req.body);
  revalidateWebsite();
  res.status(200).json(new ApiResponse(200, "Category updated", category));
});

export const deleteBlogCategory = asyncHandler(async (req: Request, res: Response) => {
  await deleteBlogCategoryService(String(req.params.id));
  revalidateWebsite();
  res.status(200).json(new ApiResponse(200, "Category deleted", { deleted: true }));
});
