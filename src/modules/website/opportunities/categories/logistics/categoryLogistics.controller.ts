import { Request, Response } from "express";
import asyncHandler from "../../../../../utils/asyncHandler";
import { ApiResponse } from "../../../../../utils/ApiResponse";
import {
  getCategoryLogisticsService,
  updateCategoryLogisticsService,
  createCategoryLogisticsService,
  getAllCategoryLogisticsService,
  getCategoryLogisticsByIdService,
  updateCategoryLogisticsByIdService,
  deleteCategoryLogisticsByIdService,
} from "./categoryLogistics.service";

export const getCategoryLogistics = asyncHandler(async (_req: Request, res: Response) => {
  const data = await getCategoryLogisticsService();
  res.status(200).json(new ApiResponse(200, "Category Logistics fetched successfully", data));
});

export const updateCategoryLogistics = asyncHandler(async (req: Request, res: Response) => {
  const data = await updateCategoryLogisticsService(req.body, req.files);
  res.status(200).json(new ApiResponse(200, "Category Logistics updated successfully", data));
});

export const createCategoryLogistics = asyncHandler(async (req: Request, res: Response) => {
  const data = await createCategoryLogisticsService(req.body, req.files);
  res.status(201).json(new ApiResponse(201, "Category Logistics created successfully", data));
});

export const getAllCategoryLogistics = asyncHandler(async (_req: Request, res: Response) => {
  const data = await getAllCategoryLogisticsService();
  res.status(200).json(new ApiResponse(200, "Category Logistics list fetched successfully", data));
});

export const getCategoryLogisticsById = asyncHandler(async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const data = await getCategoryLogisticsByIdService(id);
  res.status(200).json(new ApiResponse(200, "Category Logistics fetched successfully", data));
});

export const updateCategoryLogisticsById = asyncHandler(async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const data = await updateCategoryLogisticsByIdService(id, req.body, req.files);
  res.status(200).json(new ApiResponse(200, "Category Logistics updated successfully", data));
});

export const deleteCategoryLogisticsById = asyncHandler(async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const data = await deleteCategoryLogisticsByIdService(id);
  res.status(200).json(new ApiResponse(200, "Category Logistics deleted successfully", data));
});
