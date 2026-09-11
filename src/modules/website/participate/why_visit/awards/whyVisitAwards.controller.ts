import { Request, Response } from "express";
import asyncHandler from "../../../../../utils/asyncHandler";
import { ApiResponse } from "../../../../../utils/ApiResponse";
import {
  getWhyVisitAwardsService,
  updateWhyVisitAwardsService,
  createWhyVisitAwardsService,
  getAllWhyVisitAwardsService,
  getWhyVisitAwardsByIdService,
  updateWhyVisitAwardsByIdService,
  deleteWhyVisitAwardsByIdService,
} from "./whyVisitAwards.service";

export const getWhyVisitAwards = asyncHandler(async (_req: Request, res: Response) => {
  const data = await getWhyVisitAwardsService();
  res.status(200).json(new ApiResponse(200, "Why Visit Awards fetched successfully", data));
});

export const updateWhyVisitAwards = asyncHandler(async (req: Request, res: Response) => {
  const data = await updateWhyVisitAwardsService(req.body, req.files);
  res.status(200).json(new ApiResponse(200, "Why Visit Awards updated successfully", data));
});

export const createWhyVisitAwards = asyncHandler(async (req: Request, res: Response) => {
  const data = await createWhyVisitAwardsService(req.body, req.files);
  res.status(201).json(new ApiResponse(201, "Why Visit Awards created successfully", data));
});

export const getAllWhyVisitAwards = asyncHandler(async (_req: Request, res: Response) => {
  const data = await getAllWhyVisitAwardsService();
  res.status(200).json(new ApiResponse(200, "Why Visit Awards list fetched successfully", data));
});

export const getWhyVisitAwardsById = asyncHandler(async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const data = await getWhyVisitAwardsByIdService(id);
  res.status(200).json(new ApiResponse(200, "Why Visit Awards fetched successfully", data));
});

export const updateWhyVisitAwardsById = asyncHandler(async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const data = await updateWhyVisitAwardsByIdService(id, req.body, req.files);
  res.status(200).json(new ApiResponse(200, "Why Visit Awards updated successfully", data));
});

export const deleteWhyVisitAwardsById = asyncHandler(async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const data = await deleteWhyVisitAwardsByIdService(id);
  res.status(200).json(new ApiResponse(200, "Why Visit Awards deleted successfully", data));
});
