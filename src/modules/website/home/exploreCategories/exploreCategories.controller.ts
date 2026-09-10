import { Request, Response } from "express";
import asyncHandler from "../../../../utils/asyncHandler";
import { ApiResponse } from "../../../../utils/ApiResponse";
import {
  createExploreCategoryService,
  getAllExploreCategoriesService,
  getExploreCategoryByIdService,
  updateExploreCategoryByIdService,
  deleteExploreCategoryByIdService,
} from "./exploreCategories.service";

export const createExploreCategory = asyncHandler(async (req: Request, res: Response) => {
  const data = await createExploreCategoryService(req.body, req.file);
  res.status(201).json(new ApiResponse(201, "Category created successfully", data));
});

export const getAllExploreCategories = asyncHandler(async (_req: Request, res: Response) => {
  const data = await getAllExploreCategoriesService();
  res.status(200).json(new ApiResponse(200, "Categories fetched successfully", data));
});

export const getExploreCategoryById = asyncHandler(async (req: Request, res: Response) => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const data = await getExploreCategoryByIdService(id);
  res.status(200).json(new ApiResponse(200, "Category fetched successfully", data));
});

export const updateExploreCategoryById = asyncHandler(async (req: Request, res: Response) => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const data = await updateExploreCategoryByIdService(id, req.body, req.file);
  res.status(200).json(new ApiResponse(200, "Category updated successfully", data));
});

export const deleteExploreCategoryById = asyncHandler(async (req: Request, res: Response) => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const data = await deleteExploreCategoryByIdService(id);
  res.status(200).json(new ApiResponse(200, "Category deleted successfully", data));
});
