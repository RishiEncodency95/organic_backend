import { Request, Response } from "express";
import asyncHandler from "../../../../../utils/asyncHandler";
import { ApiResponse } from "../../../../../utils/ApiResponse";
import {
  getPartnershipOpportunitiesService,
  updatePartnershipOpportunitiesService,
  createPartnershipOpportunitiesService,
  getAllPartnershipOpportunitiesService,
  getPartnershipOpportunitiesByIdService,
  updatePartnershipOpportunitiesByIdService,
  deletePartnershipOpportunitiesByIdService,
} from "./partnershipOpportunities.service";

export const getPartnershipOpportunities = asyncHandler(async (_req: Request, res: Response) => {
  const data = await getPartnershipOpportunitiesService();
  res.status(200).json(new ApiResponse(200, "Partnership Opportunities fetched successfully", data));
});

export const updatePartnershipOpportunities = asyncHandler(async (req: Request, res: Response) => {
  const data = await updatePartnershipOpportunitiesService(req.body, req.files);
  res.status(200).json(new ApiResponse(200, "Partnership Opportunities updated successfully", data));
});

export const createPartnershipOpportunities = asyncHandler(async (req: Request, res: Response) => {
  const data = await createPartnershipOpportunitiesService(req.body, req.files);
  res.status(201).json(new ApiResponse(201, "Partnership Opportunities created successfully", data));
});

export const getAllPartnershipOpportunities = asyncHandler(async (_req: Request, res: Response) => {
  const data = await getAllPartnershipOpportunitiesService();
  res.status(200).json(new ApiResponse(200, "Partnership Opportunities list fetched successfully", data));
});

export const getPartnershipOpportunitiesById = asyncHandler(async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const data = await getPartnershipOpportunitiesByIdService(id);
  res.status(200).json(new ApiResponse(200, "Partnership Opportunities fetched successfully", data));
});

export const updatePartnershipOpportunitiesById = asyncHandler(async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const data = await updatePartnershipOpportunitiesByIdService(id, req.body, req.files);
  res.status(200).json(new ApiResponse(200, "Partnership Opportunities updated successfully", data));
});

export const deletePartnershipOpportunitiesById = asyncHandler(async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const data = await deletePartnershipOpportunitiesByIdService(id);
  res.status(200).json(new ApiResponse(200, "Partnership Opportunities deleted successfully", data));
});
