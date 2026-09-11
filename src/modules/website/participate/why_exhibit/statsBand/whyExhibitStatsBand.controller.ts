import { Request, Response } from "express";
import asyncHandler from "../../../../../utils/asyncHandler";
import { ApiResponse } from "../../../../../utils/ApiResponse";
import {
  getAllWhyExhibitStatsBandService,
  createWhyExhibitStatsBandService,
  getWhyExhibitStatsBandByIdService,
  updateWhyExhibitStatsBandByIdService,
  deleteWhyExhibitStatsBandByIdService,
} from "./whyExhibitStatsBand.service";

export const getAllWhyExhibitStatsBand = asyncHandler(async (_req: Request, res: Response) => {
  const data = await getAllWhyExhibitStatsBandService();
  res.status(200).json(new ApiResponse(200, "Stats band items fetched successfully", data));
});

export const createWhyExhibitStatsBand = asyncHandler(async (req: Request, res: Response) => {
  const data = await createWhyExhibitStatsBandService(req.body);
  res.status(201).json(new ApiResponse(201, "Stat item created successfully", data));
});

export const getWhyExhibitStatsBandById = asyncHandler(async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const data = await getWhyExhibitStatsBandByIdService(id);
  res.status(200).json(new ApiResponse(200, "Stat item fetched successfully", data));
});

export const updateWhyExhibitStatsBandById = asyncHandler(async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const data = await updateWhyExhibitStatsBandByIdService(id, req.body);
  res.status(200).json(new ApiResponse(200, "Stat item updated successfully", data));
});

export const deleteWhyExhibitStatsBandById = asyncHandler(async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const data = await deleteWhyExhibitStatsBandByIdService(id);
  res.status(200).json(new ApiResponse(200, "Stat item deleted successfully", data));
});
