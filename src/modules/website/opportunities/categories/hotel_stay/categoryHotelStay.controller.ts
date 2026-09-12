import { Request, Response } from "express";
import asyncHandler from "../../../../../utils/asyncHandler";
import { ApiResponse } from "../../../../../utils/ApiResponse";
import {
  getCategoryHotelStayService,
  updateCategoryHotelStayService,
  createCategoryHotelStayService,
  getAllCategoryHotelStayService,
  getCategoryHotelStayByIdService,
  updateCategoryHotelStayByIdService,
  deleteCategoryHotelStayByIdService,
} from "./categoryHotelStay.service";

export const getCategoryHotelStay = asyncHandler(async (_req: Request, res: Response) => {
  const data = await getCategoryHotelStayService();
  res.status(200).json(new ApiResponse(200, "Category Hotel Stay fetched successfully", data));
});

export const updateCategoryHotelStay = asyncHandler(async (req: Request, res: Response) => {
  const data = await updateCategoryHotelStayService(req.body, req.files);
  res.status(200).json(new ApiResponse(200, "Category Hotel Stay updated successfully", data));
});

export const createCategoryHotelStay = asyncHandler(async (req: Request, res: Response) => {
  const data = await createCategoryHotelStayService(req.body, req.files);
  res.status(201).json(new ApiResponse(201, "Category Hotel Stay created successfully", data));
});

export const getAllCategoryHotelStay = asyncHandler(async (_req: Request, res: Response) => {
  const data = await getAllCategoryHotelStayService();
  res.status(200).json(new ApiResponse(200, "Category Hotel Stay list fetched successfully", data));
});

export const getCategoryHotelStayById = asyncHandler(async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const data = await getCategoryHotelStayByIdService(id);
  res.status(200).json(new ApiResponse(200, "Category Hotel Stay fetched successfully", data));
});

export const updateCategoryHotelStayById = asyncHandler(async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const data = await updateCategoryHotelStayByIdService(id, req.body, req.files);
  res.status(200).json(new ApiResponse(200, "Category Hotel Stay updated successfully", data));
});

export const deleteCategoryHotelStayById = asyncHandler(async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const data = await deleteCategoryHotelStayByIdService(id);
  res.status(200).json(new ApiResponse(200, "Category Hotel Stay deleted successfully", data));
});
