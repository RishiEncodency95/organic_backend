import { Request, Response } from "express";
import asyncHandler from "../../../../../utils/asyncHandler";
import { ApiResponse } from "../../../../../utils/ApiResponse";
import {
  getExhibitorListCtaService,
  updateExhibitorListCtaService,
  createExhibitorListCtaService,
  getAllExhibitorListCtaService,
  getExhibitorListCtaByIdService,
  updateExhibitorListCtaByIdService,
  deleteExhibitorListCtaByIdService,
} from "./exhibitorListCta.service";

export const getExhibitorListCta = asyncHandler(async (_req: Request, res: Response) => {
  const data = await getExhibitorListCtaService();
  res.status(200).json(new ApiResponse(200, "Exhibitor List CTA fetched successfully", data));
});

export const updateExhibitorListCta = asyncHandler(async (req: Request, res: Response) => {
  const data = await updateExhibitorListCtaService(req.body, req.files);
  res.status(200).json(new ApiResponse(200, "Exhibitor List CTA updated successfully", data));
});

export const createExhibitorListCta = asyncHandler(async (req: Request, res: Response) => {
  const data = await createExhibitorListCtaService(req.body, req.files);
  res.status(201).json(new ApiResponse(201, "Exhibitor List CTA created successfully", data));
});

export const getAllExhibitorListCta = asyncHandler(async (_req: Request, res: Response) => {
  const data = await getAllExhibitorListCtaService();
  res.status(200).json(new ApiResponse(200, "Exhibitor List CTA list fetched successfully", data));
});

export const getExhibitorListCtaById = asyncHandler(async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const data = await getExhibitorListCtaByIdService(id);
  res.status(200).json(new ApiResponse(200, "Exhibitor List CTA fetched successfully", data));
});

export const updateExhibitorListCtaById = asyncHandler(async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const data = await updateExhibitorListCtaByIdService(id, req.body, req.files);
  res.status(200).json(new ApiResponse(200, "Exhibitor List CTA updated successfully", data));
});

export const deleteExhibitorListCtaById = asyncHandler(async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const data = await deleteExhibitorListCtaByIdService(id);
  res.status(200).json(new ApiResponse(200, "Exhibitor List CTA deleted successfully", data));
});
