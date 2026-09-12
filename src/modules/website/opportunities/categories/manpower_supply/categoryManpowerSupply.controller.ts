import { Request, Response } from "express";
import asyncHandler from "../../../../../utils/asyncHandler";
import { ApiResponse } from "../../../../../utils/ApiResponse";
import {
  getCategoryManpowerSupplyService,
  updateCategoryManpowerSupplyService,
  createCategoryManpowerSupplyService,
  getAllCategoryManpowerSupplyService,
  getCategoryManpowerSupplyByIdService,
  updateCategoryManpowerSupplyByIdService,
  deleteCategoryManpowerSupplyByIdService,
} from "./categoryManpowerSupply.service";

export const getCategoryManpowerSupply = asyncHandler(async (_req: Request, res: Response) => {
  const data = await getCategoryManpowerSupplyService();
  res.status(200).json(new ApiResponse(200, "Category Manpower Supply fetched successfully", data));
});

export const updateCategoryManpowerSupply = asyncHandler(async (req: Request, res: Response) => {
  const data = await updateCategoryManpowerSupplyService(req.body, req.files);
  res.status(200).json(new ApiResponse(200, "Category Manpower Supply updated successfully", data));
});

export const createCategoryManpowerSupply = asyncHandler(async (req: Request, res: Response) => {
  const data = await createCategoryManpowerSupplyService(req.body, req.files);
  res.status(201).json(new ApiResponse(201, "Category Manpower Supply created successfully", data));
});

export const getAllCategoryManpowerSupply = asyncHandler(async (_req: Request, res: Response) => {
  const data = await getAllCategoryManpowerSupplyService();
  res.status(200).json(new ApiResponse(200, "Category Manpower Supply list fetched successfully", data));
});

export const getCategoryManpowerSupplyById = asyncHandler(async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const data = await getCategoryManpowerSupplyByIdService(id);
  res.status(200).json(new ApiResponse(200, "Category Manpower Supply fetched successfully", data));
});

export const updateCategoryManpowerSupplyById = asyncHandler(async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const data = await updateCategoryManpowerSupplyByIdService(id, req.body, req.files);
  res.status(200).json(new ApiResponse(200, "Category Manpower Supply updated successfully", data));
});

export const deleteCategoryManpowerSupplyById = asyncHandler(async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const data = await deleteCategoryManpowerSupplyByIdService(id);
  res.status(200).json(new ApiResponse(200, "Category Manpower Supply deleted successfully", data));
});
