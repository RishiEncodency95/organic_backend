import { Request, Response } from "express";
import asyncHandler from "../../../../../utils/asyncHandler";
import { ApiResponse } from "../../../../../utils/ApiResponse";
import {
  getEPromotionOpportunitiesService,
  updateEPromotionOpportunitiesService,
  createEPromotionOpportunitiesService,
  getAllEPromotionOpportunitiesService,
  getEPromotionOpportunitiesByIdService,
  updateEPromotionOpportunitiesByIdService,
  deleteEPromotionOpportunitiesByIdService,
} from "./epromotionOpportunities.service";

export const getEPromotionOpportunities = asyncHandler(async (_req: Request, res: Response) => {
  const data = await getEPromotionOpportunitiesService();
  res.status(200).json(new ApiResponse(200, "E-Promotion Opportunities fetched successfully", data));
});

export const updateEPromotionOpportunities = asyncHandler(async (req: Request, res: Response) => {
  const data = await updateEPromotionOpportunitiesService(req.body, req.files);
  res.status(200).json(new ApiResponse(200, "E-Promotion Opportunities updated successfully", data));
});

export const createEPromotionOpportunities = asyncHandler(async (req: Request, res: Response) => {
  const data = await createEPromotionOpportunitiesService(req.body, req.files);
  res.status(201).json(new ApiResponse(201, "E-Promotion Opportunities created successfully", data));
});

export const getAllEPromotionOpportunities = asyncHandler(async (_req: Request, res: Response) => {
  const data = await getAllEPromotionOpportunitiesService();
  res.status(200).json(new ApiResponse(200, "E-Promotion Opportunities list fetched successfully", data));
});

export const getEPromotionOpportunitiesById = asyncHandler(async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const data = await getEPromotionOpportunitiesByIdService(id);
  res.status(200).json(new ApiResponse(200, "E-Promotion Opportunities fetched successfully", data));
});

export const updateEPromotionOpportunitiesById = asyncHandler(async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const data = await updateEPromotionOpportunitiesByIdService(id, req.body, req.files);
  res.status(200).json(new ApiResponse(200, "E-Promotion Opportunities updated successfully", data));
});

export const deleteEPromotionOpportunitiesById = asyncHandler(async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const data = await deleteEPromotionOpportunitiesByIdService(id);
  res.status(200).json(new ApiResponse(200, "E-Promotion Opportunities deleted successfully", data));
});
