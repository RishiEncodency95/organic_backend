import { Request, Response } from "express";
import asyncHandler from "../../../../../utils/asyncHandler";
import { ApiResponse } from "../../../../../utils/ApiResponse";
import {
  getWhyVisitSupportService,
  updateWhyVisitSupportService,
  createWhyVisitSupportService,
  getAllWhyVisitSupportService,
  getWhyVisitSupportByIdService,
  updateWhyVisitSupportByIdService,
  deleteWhyVisitSupportByIdService,
} from "./whyVisitSupport.service";

export const getWhyVisitSupport = asyncHandler(async (_req: Request, res: Response) => {
  const data = await getWhyVisitSupportService();
  res.status(200).json(new ApiResponse(200, "Why Visit Support fetched successfully", data));
});

export const updateWhyVisitSupport = asyncHandler(async (req: Request, res: Response) => {
  const data = await updateWhyVisitSupportService(req.body, req.files);
  res.status(200).json(new ApiResponse(200, "Why Visit Support updated successfully", data));
});

export const createWhyVisitSupport = asyncHandler(async (req: Request, res: Response) => {
  const data = await createWhyVisitSupportService(req.body, req.files);
  res.status(201).json(new ApiResponse(201, "Why Visit Support created successfully", data));
});

export const getAllWhyVisitSupport = asyncHandler(async (_req: Request, res: Response) => {
  const data = await getAllWhyVisitSupportService();
  res.status(200).json(new ApiResponse(200, "Why Visit Support list fetched successfully", data));
});

export const getWhyVisitSupportById = asyncHandler(async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const data = await getWhyVisitSupportByIdService(id);
  res.status(200).json(new ApiResponse(200, "Why Visit Support fetched successfully", data));
});

export const updateWhyVisitSupportById = asyncHandler(async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const data = await updateWhyVisitSupportByIdService(id, req.body, req.files);
  res.status(200).json(new ApiResponse(200, "Why Visit Support updated successfully", data));
});

export const deleteWhyVisitSupportById = asyncHandler(async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const data = await deleteWhyVisitSupportByIdService(id);
  res.status(200).json(new ApiResponse(200, "Why Visit Support deleted successfully", data));
});
