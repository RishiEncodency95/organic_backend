import { Request, Response } from "express";
import asyncHandler from "../../../../../utils/asyncHandler";
import { ApiResponse } from "../../../../../utils/ApiResponse";
import {
  getCategoryPrintingBrandingService,
  updateCategoryPrintingBrandingService,
  createCategoryPrintingBrandingService,
  getAllCategoryPrintingBrandingService,
  getCategoryPrintingBrandingByIdService,
  updateCategoryPrintingBrandingByIdService,
  deleteCategoryPrintingBrandingByIdService,
} from "./categoryPrintingBranding.service";

export const getCategoryPrintingBranding = asyncHandler(async (_req: Request, res: Response) => {
  const data = await getCategoryPrintingBrandingService();
  res.status(200).json(new ApiResponse(200, "Category Printing & Branding fetched successfully", data));
});

export const updateCategoryPrintingBranding = asyncHandler(async (req: Request, res: Response) => {
  const data = await updateCategoryPrintingBrandingService(req.body, req.files);
  res.status(200).json(new ApiResponse(200, "Category Printing & Branding updated successfully", data));
});

export const createCategoryPrintingBranding = asyncHandler(async (req: Request, res: Response) => {
  const data = await createCategoryPrintingBrandingService(req.body, req.files);
  res.status(201).json(new ApiResponse(201, "Category Printing & Branding created successfully", data));
});

export const getAllCategoryPrintingBranding = asyncHandler(async (_req: Request, res: Response) => {
  const data = await getAllCategoryPrintingBrandingService();
  res.status(200).json(new ApiResponse(200, "Category Printing & Branding list fetched successfully", data));
});

export const getCategoryPrintingBrandingById = asyncHandler(async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const data = await getCategoryPrintingBrandingByIdService(id);
  res.status(200).json(new ApiResponse(200, "Category Printing & Branding fetched successfully", data));
});

export const updateCategoryPrintingBrandingById = asyncHandler(async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const data = await updateCategoryPrintingBrandingByIdService(id, req.body, req.files);
  res.status(200).json(new ApiResponse(200, "Category Printing & Branding updated successfully", data));
});

export const deleteCategoryPrintingBrandingById = asyncHandler(async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const data = await deleteCategoryPrintingBrandingByIdService(id);
  res.status(200).json(new ApiResponse(200, "Category Printing & Branding deleted successfully", data));
});
