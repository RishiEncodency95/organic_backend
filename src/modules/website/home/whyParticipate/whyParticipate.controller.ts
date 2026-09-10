import { Request, Response } from "express";
import asyncHandler from "../../../../utils/asyncHandler";
import { ApiResponse } from "../../../../utils/ApiResponse";
import {
  getWhyParticipateService,
  updateWhyParticipateService,
  createWhyParticipateService,
  getAllWhyParticipateService,
  getWhyParticipateByIdService,
  updateWhyParticipateByIdService,
  deleteWhyParticipateByIdService,
} from "./whyParticipate.service";

export const getWhyParticipate = asyncHandler(async (_req: Request, res: Response) => {
  const data = await getWhyParticipateService();
  res.status(200).json(new ApiResponse(200, "Why Participate fetched successfully", data));
});

export const updateWhyParticipate = asyncHandler(async (req: Request, res: Response) => {
  const data = await updateWhyParticipateService(req.body, req.files);
  res.status(200).json(new ApiResponse(200, "Why Participate updated successfully", data));
});

export const createWhyParticipate = asyncHandler(async (req: Request, res: Response) => {
  const data = await createWhyParticipateService(req.body, req.files);
  res.status(201).json(new ApiResponse(201, "Why Participate created successfully", data));
});

export const getAllWhyParticipate = asyncHandler(async (_req: Request, res: Response) => {
  const data = await getAllWhyParticipateService();
  res.status(200).json(new ApiResponse(200, "Why Participate list fetched successfully", data));
});

export const getWhyParticipateById = asyncHandler(async (req: Request, res: Response) => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const data = await getWhyParticipateByIdService(id);
  res.status(200).json(new ApiResponse(200, "Why Participate fetched successfully", data));
});

export const updateWhyParticipateById = asyncHandler(async (req: Request, res: Response) => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const data = await updateWhyParticipateByIdService(id, req.body, req.files);
  res.status(200).json(new ApiResponse(200, "Why Participate updated successfully", data));
});

export const deleteWhyParticipateById = asyncHandler(async (req: Request, res: Response) => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const data = await deleteWhyParticipateByIdService(id);
  res.status(200).json(new ApiResponse(200, "Why Participate deleted successfully", data));
});
