import { Request, Response } from "express";
import asyncHandler from "../../../../../utils/asyncHandler";
import { ApiResponse } from "../../../../../utils/ApiResponse";
import {
  getCategoryStallDesignService,
  updateCategoryStallDesignService,
  createCategoryStallDesignService,
  getAllCategoryStallDesignService,
  getCategoryStallDesignByIdService,
  updateCategoryStallDesignByIdService,
  deleteCategoryStallDesignByIdService,
} from "./categoryStallDesign.service";

export const getCategoryStallDesign = asyncHandler(async (_req: Request, res: Response) => {
  const data = await getCategoryStallDesignService();
  res.status(200).json(new ApiResponse(200, "Category Stall Design fetched successfully", data));
});

export const updateCategoryStallDesign = asyncHandler(async (req: Request, res: Response) => {
  const data = await updateCategoryStallDesignService(req.body, req.files);
  res.status(200).json(new ApiResponse(200, "Category Stall Design updated successfully", data));
});

export const createCategoryStallDesign = asyncHandler(async (req: Request, res: Response) => {
  const data = await createCategoryStallDesignService(req.body, req.files);
  res.status(201).json(new ApiResponse(201, "Category Stall Design created successfully", data));
});

export const getAllCategoryStallDesign = asyncHandler(async (_req: Request, res: Response) => {
  const data = await getAllCategoryStallDesignService();
  res.status(200).json(new ApiResponse(200, "Category Stall Design list fetched successfully", data));
});

export const getCategoryStallDesignById = asyncHandler(async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const data = await getCategoryStallDesignByIdService(id);
  res.status(200).json(new ApiResponse(200, "Category Stall Design fetched successfully", data));
});

export const updateCategoryStallDesignById = asyncHandler(async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const data = await updateCategoryStallDesignByIdService(id, req.body, req.files);
  res.status(200).json(new ApiResponse(200, "Category Stall Design updated successfully", data));
});

export const deleteCategoryStallDesignById = asyncHandler(async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const data = await deleteCategoryStallDesignByIdService(id);
  res.status(200).json(new ApiResponse(200, "Category Stall Design deleted successfully", data));
});
