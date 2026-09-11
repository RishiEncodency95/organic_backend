import { Request, Response } from "express";
import asyncHandler from "../../../../../utils/asyncHandler";
import { ApiResponse } from "../../../../../utils/ApiResponse";
import {
  getWhyVisitMattersService,
  updateWhyVisitMattersService,
  createWhyVisitMattersService,
  getAllWhyVisitMattersService,
  getWhyVisitMattersByIdService,
  updateWhyVisitMattersByIdService,
  deleteWhyVisitMattersByIdService,
} from "./whyVisitMatters.service";

export const getWhyVisitMatters = asyncHandler(async (_req: Request, res: Response) => {
  const data = await getWhyVisitMattersService();
  res.status(200).json(new ApiResponse(200, "Why Visit Matters fetched successfully", data));
});

export const updateWhyVisitMatters = asyncHandler(async (req: Request, res: Response) => {
  const data = await updateWhyVisitMattersService(req.body, req.files);
  res.status(200).json(new ApiResponse(200, "Why Visit Matters updated successfully", data));
});

export const createWhyVisitMatters = asyncHandler(async (req: Request, res: Response) => {
  const data = await createWhyVisitMattersService(req.body, req.files);
  res.status(201).json(new ApiResponse(201, "Why Visit Matters created successfully", data));
});

export const getAllWhyVisitMatters = asyncHandler(async (_req: Request, res: Response) => {
  const data = await getAllWhyVisitMattersService();
  res.status(200).json(new ApiResponse(200, "Why Visit Matters list fetched successfully", data));
});

export const getWhyVisitMattersById = asyncHandler(async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const data = await getWhyVisitMattersByIdService(id);
  res.status(200).json(new ApiResponse(200, "Why Visit Matters fetched successfully", data));
});

export const updateWhyVisitMattersById = asyncHandler(async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const data = await updateWhyVisitMattersByIdService(id, req.body, req.files);
  res.status(200).json(new ApiResponse(200, "Why Visit Matters updated successfully", data));
});

export const deleteWhyVisitMattersById = asyncHandler(async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const data = await deleteWhyVisitMattersByIdService(id);
  res.status(200).json(new ApiResponse(200, "Why Visit Matters deleted successfully", data));
});
