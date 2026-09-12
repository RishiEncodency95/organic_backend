import { Request, Response } from "express";
import asyncHandler from "../../../../../utils/asyncHandler";
import { ApiResponse } from "../../../../../utils/ApiResponse";
import {
  getWhyVisitSegmentsService,
  updateWhyVisitSegmentsService,
  createWhyVisitSegmentsService,
  getAllWhyVisitSegmentsService,
  getWhyVisitSegmentsByIdService,
  updateWhyVisitSegmentsByIdService,
  deleteWhyVisitSegmentsByIdService,
} from "./whyVisitSegments.service";

export const getWhyVisitSegments = asyncHandler(async (_req: Request, res: Response) => {
  const data = await getWhyVisitSegmentsService();
  res.status(200).json(new ApiResponse(200, "Why Visit Segments fetched successfully", data));
});

export const updateWhyVisitSegments = asyncHandler(async (req: Request, res: Response) => {
  const data = await updateWhyVisitSegmentsService(req.body, req.files);
  res.status(200).json(new ApiResponse(200, "Why Visit Segments updated successfully", data));
});

export const createWhyVisitSegments = asyncHandler(async (req: Request, res: Response) => {
  const data = await createWhyVisitSegmentsService(req.body, req.files);
  res.status(201).json(new ApiResponse(201, "Why Visit Segments created successfully", data));
});

export const getAllWhyVisitSegments = asyncHandler(async (_req: Request, res: Response) => {
  const data = await getAllWhyVisitSegmentsService();
  res.status(200).json(new ApiResponse(200, "Why Visit Segments list fetched successfully", data));
});

export const getWhyVisitSegmentsById = asyncHandler(async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const data = await getWhyVisitSegmentsByIdService(id);
  res.status(200).json(new ApiResponse(200, "Why Visit Segments fetched successfully", data));
});

export const updateWhyVisitSegmentsById = asyncHandler(async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const data = await updateWhyVisitSegmentsByIdService(id, req.body, req.files);
  res.status(200).json(new ApiResponse(200, "Why Visit Segments updated successfully", data));
});

export const deleteWhyVisitSegmentsById = asyncHandler(async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const data = await deleteWhyVisitSegmentsByIdService(id);
  res.status(200).json(new ApiResponse(200, "Why Visit Segments deleted successfully", data));
});
