import { Request, Response } from "express";
import asyncHandler from "../../../../../utils/asyncHandler";
import { ApiResponse } from "../../../../../utils/ApiResponse";
import {
  getEPromotionBandService,
  updateEPromotionBandService,
  createEPromotionBandService,
  getAllEPromotionBandService,
  getEPromotionBandByIdService,
  updateEPromotionBandByIdService,
  deleteEPromotionBandByIdService,
} from "./epromotionBand.service";

export const getEPromotionBand = asyncHandler(async (_req: Request, res: Response) => {
  const data = await getEPromotionBandService();
  res.status(200).json(new ApiResponse(200, "E-Promotion Band fetched successfully", data));
});

export const updateEPromotionBand = asyncHandler(async (req: Request, res: Response) => {
  const data = await updateEPromotionBandService(req.body, req.files);
  res.status(200).json(new ApiResponse(200, "E-Promotion Band updated successfully", data));
});

export const createEPromotionBand = asyncHandler(async (req: Request, res: Response) => {
  const data = await createEPromotionBandService(req.body, req.files);
  res.status(201).json(new ApiResponse(201, "E-Promotion Band created successfully", data));
});

export const getAllEPromotionBand = asyncHandler(async (_req: Request, res: Response) => {
  const data = await getAllEPromotionBandService();
  res.status(200).json(new ApiResponse(200, "E-Promotion Band list fetched successfully", data));
});

export const getEPromotionBandById = asyncHandler(async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const data = await getEPromotionBandByIdService(id);
  res.status(200).json(new ApiResponse(200, "E-Promotion Band fetched successfully", data));
});

export const updateEPromotionBandById = asyncHandler(async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const data = await updateEPromotionBandByIdService(id, req.body, req.files);
  res.status(200).json(new ApiResponse(200, "E-Promotion Band updated successfully", data));
});

export const deleteEPromotionBandById = asyncHandler(async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const data = await deleteEPromotionBandByIdService(id);
  res.status(200).json(new ApiResponse(200, "E-Promotion Band deleted successfully", data));
});
