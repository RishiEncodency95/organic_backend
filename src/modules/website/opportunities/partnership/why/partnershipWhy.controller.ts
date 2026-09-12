import { Request, Response } from "express";
import asyncHandler from "../../../../../utils/asyncHandler";
import { ApiResponse } from "../../../../../utils/ApiResponse";
import {
  getPartnershipWhyService,
  updatePartnershipWhyService,
  createPartnershipWhyService,
  getAllPartnershipWhyService,
  getPartnershipWhyByIdService,
  updatePartnershipWhyByIdService,
  deletePartnershipWhyByIdService,
} from "./partnershipWhy.service";

export const getPartnershipWhy = asyncHandler(async (_req: Request, res: Response) => {
  const data = await getPartnershipWhyService();
  res.status(200).json(new ApiResponse(200, "Partnership Why fetched successfully", data));
});

export const updatePartnershipWhy = asyncHandler(async (req: Request, res: Response) => {
  const data = await updatePartnershipWhyService(req.body, req.files);
  res.status(200).json(new ApiResponse(200, "Partnership Why updated successfully", data));
});

export const createPartnershipWhy = asyncHandler(async (req: Request, res: Response) => {
  const data = await createPartnershipWhyService(req.body, req.files);
  res.status(201).json(new ApiResponse(201, "Partnership Why created successfully", data));
});

export const getAllPartnershipWhy = asyncHandler(async (_req: Request, res: Response) => {
  const data = await getAllPartnershipWhyService();
  res.status(200).json(new ApiResponse(200, "Partnership Why list fetched successfully", data));
});

export const getPartnershipWhyById = asyncHandler(async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const data = await getPartnershipWhyByIdService(id);
  res.status(200).json(new ApiResponse(200, "Partnership Why fetched successfully", data));
});

export const updatePartnershipWhyById = asyncHandler(async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const data = await updatePartnershipWhyByIdService(id, req.body, req.files);
  res.status(200).json(new ApiResponse(200, "Partnership Why updated successfully", data));
});

export const deletePartnershipWhyById = asyncHandler(async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const data = await deletePartnershipWhyByIdService(id);
  res.status(200).json(new ApiResponse(200, "Partnership Why deleted successfully", data));
});
