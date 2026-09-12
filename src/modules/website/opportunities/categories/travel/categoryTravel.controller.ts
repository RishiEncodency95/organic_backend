import { Request, Response } from "express";
import asyncHandler from "../../../../../utils/asyncHandler";
import { ApiResponse } from "../../../../../utils/ApiResponse";
import {
  getCategoryTravelService,
  updateCategoryTravelService,
  createCategoryTravelService,
  getAllCategoryTravelService,
  getCategoryTravelByIdService,
  updateCategoryTravelByIdService,
  deleteCategoryTravelByIdService,
} from "./categoryTravel.service";

export const getCategoryTravel = asyncHandler(async (_req: Request, res: Response) => {
  const data = await getCategoryTravelService();
  res.status(200).json(new ApiResponse(200, "Category Travel fetched successfully", data));
});

export const updateCategoryTravel = asyncHandler(async (req: Request, res: Response) => {
  const data = await updateCategoryTravelService(req.body, req.files);
  res.status(200).json(new ApiResponse(200, "Category Travel updated successfully", data));
});

export const createCategoryTravel = asyncHandler(async (req: Request, res: Response) => {
  const data = await createCategoryTravelService(req.body, req.files);
  res.status(201).json(new ApiResponse(201, "Category Travel created successfully", data));
});

export const getAllCategoryTravel = asyncHandler(async (_req: Request, res: Response) => {
  const data = await getAllCategoryTravelService();
  res.status(200).json(new ApiResponse(200, "Category Travel list fetched successfully", data));
});

export const getCategoryTravelById = asyncHandler(async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const data = await getCategoryTravelByIdService(id);
  res.status(200).json(new ApiResponse(200, "Category Travel fetched successfully", data));
});

export const updateCategoryTravelById = asyncHandler(async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const data = await updateCategoryTravelByIdService(id, req.body, req.files);
  res.status(200).json(new ApiResponse(200, "Category Travel updated successfully", data));
});

export const deleteCategoryTravelById = asyncHandler(async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const data = await deleteCategoryTravelByIdService(id);
  res.status(200).json(new ApiResponse(200, "Category Travel deleted successfully", data));
});
