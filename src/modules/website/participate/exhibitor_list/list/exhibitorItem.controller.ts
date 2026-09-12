import { Request, Response } from "express";
import asyncHandler from "../../../../../utils/asyncHandler";
import { ApiResponse } from "../../../../../utils/ApiResponse";
import {
  getAllExhibitorItemsService,
  createExhibitorItemService,
  getExhibitorItemByIdService,
  updateExhibitorItemByIdService,
  deleteExhibitorItemByIdService,
} from "./exhibitorItem.service";

export const getAllExhibitorItems = asyncHandler(async (_req: Request, res: Response) => {
  const data = await getAllExhibitorItemsService();
  res.status(200).json(new ApiResponse(200, "Exhibitors list fetched successfully", data));
});

export const createExhibitorItem = asyncHandler(async (req: Request, res: Response) => {
  const data = await createExhibitorItemService(req.body, req.files);
  res.status(201).json(new ApiResponse(201, "Exhibitor item created successfully", data));
});

export const getExhibitorItemById = asyncHandler(async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const data = await getExhibitorItemByIdService(id);
  res.status(200).json(new ApiResponse(200, "Exhibitor item fetched successfully", data));
});

export const updateExhibitorItemById = asyncHandler(async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const data = await updateExhibitorItemByIdService(id, req.body, req.files);
  res.status(200).json(new ApiResponse(200, "Exhibitor item updated successfully", data));
});

export const deleteExhibitorItemById = asyncHandler(async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const data = await deleteExhibitorItemByIdService(id);
  res.status(200).json(new ApiResponse(200, "Exhibitor item deleted successfully", data));
});
