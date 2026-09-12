import { Request, Response } from "express";
import asyncHandler from "../../../../../utils/asyncHandler";
import { ApiResponse } from "../../../../../utils/ApiResponse";
import {
  getExhibitorListHeaderService,
  updateExhibitorListHeaderService,
  createExhibitorListHeaderService,
  getAllExhibitorListHeaderService,
  getExhibitorListHeaderByIdService,
  updateExhibitorListHeaderByIdService,
  deleteExhibitorListHeaderByIdService,
} from "./exhibitorListHeader.service";

export const getExhibitorListHeader = asyncHandler(async (_req: Request, res: Response) => {
  const data = await getExhibitorListHeaderService();
  res.status(200).json(new ApiResponse(200, "Exhibitor List Header fetched successfully", data));
});

export const updateExhibitorListHeader = asyncHandler(async (req: Request, res: Response) => {
  const data = await updateExhibitorListHeaderService(req.body);
  res.status(200).json(new ApiResponse(200, "Exhibitor List Header updated successfully", data));
});

export const createExhibitorListHeader = asyncHandler(async (req: Request, res: Response) => {
  const data = await createExhibitorListHeaderService(req.body);
  res.status(201).json(new ApiResponse(201, "Exhibitor List Header created successfully", data));
});

export const getAllExhibitorListHeader = asyncHandler(async (_req: Request, res: Response) => {
  const data = await getAllExhibitorListHeaderService();
  res.status(200).json(new ApiResponse(200, "Exhibitor List Header list fetched successfully", data));
});

export const getExhibitorListHeaderById = asyncHandler(async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const data = await getExhibitorListHeaderByIdService(id);
  res.status(200).json(new ApiResponse(200, "Exhibitor List Header fetched successfully", data));
});

export const updateExhibitorListHeaderById = asyncHandler(async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const data = await updateExhibitorListHeaderByIdService(id, req.body);
  res.status(200).json(new ApiResponse(200, "Exhibitor List Header updated successfully", data));
});

export const deleteExhibitorListHeaderById = asyncHandler(async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const data = await deleteExhibitorListHeaderByIdService(id);
  res.status(200).json(new ApiResponse(200, "Exhibitor List Header deleted successfully", data));
});
