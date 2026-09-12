import { Request, Response } from "express";
import asyncHandler from "../../../../../utils/asyncHandler";
import { ApiResponse } from "../../../../../utils/ApiResponse";
import {
  getEPromotionWhyService,
  updateEPromotionWhyService,
  createEPromotionWhyService,
  getAllEPromotionWhyService,
  getEPromotionWhyByIdService,
  updateEPromotionWhyByIdService,
  deleteEPromotionWhyByIdService,
} from "./epromotionWhy.service";

export const getEPromotionWhy = asyncHandler(async (_req: Request, res: Response) => {
  const data = await getEPromotionWhyService();
  res.status(200).json(new ApiResponse(200, "E-Promotion Why fetched successfully", data));
});

export const updateEPromotionWhy = asyncHandler(async (req: Request, res: Response) => {
  const data = await updateEPromotionWhyService(req.body, req.files);
  res.status(200).json(new ApiResponse(200, "E-Promotion Why updated successfully", data));
});

export const createEPromotionWhy = asyncHandler(async (req: Request, res: Response) => {
  const data = await createEPromotionWhyService(req.body, req.files);
  res.status(201).json(new ApiResponse(201, "E-Promotion Why created successfully", data));
});

export const getAllEPromotionWhy = asyncHandler(async (_req: Request, res: Response) => {
  const data = await getAllEPromotionWhyService();
  res.status(200).json(new ApiResponse(200, "E-Promotion Why list fetched successfully", data));
});

export const getEPromotionWhyById = asyncHandler(async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const data = await getEPromotionWhyByIdService(id);
  res.status(200).json(new ApiResponse(200, "E-Promotion Why fetched successfully", data));
});

export const updateEPromotionWhyById = asyncHandler(async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const data = await updateEPromotionWhyByIdService(id, req.body, req.files);
  res.status(200).json(new ApiResponse(200, "E-Promotion Why updated successfully", data));
});

export const deleteEPromotionWhyById = asyncHandler(async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const data = await deleteEPromotionWhyByIdService(id);
  res.status(200).json(new ApiResponse(200, "E-Promotion Why deleted successfully", data));
});
