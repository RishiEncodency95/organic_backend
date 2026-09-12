import { Request, Response } from "express";
import asyncHandler from "../../../../../utils/asyncHandler";
import { ApiResponse } from "../../../../../utils/ApiResponse";
import {
  getAllWhyExhibitReasonsService,
  createWhyExhibitReasonsService,
  getWhyExhibitReasonsByIdService,
  updateWhyExhibitReasonsByIdService,
  deleteWhyExhibitReasonsByIdService,
} from "./whyExhibitReasons.service";

export const getAllWhyExhibitReasons = asyncHandler(async (_req: Request, res: Response) => {
  const data = await getAllWhyExhibitReasonsService();
  res.status(200).json(new ApiResponse(200, "Why Exhibit reasons fetched successfully", data));
});

export const createWhyExhibitReasons = asyncHandler(async (req: Request, res: Response) => {
  const data = await createWhyExhibitReasonsService(req.body, req.files);
  res.status(201).json(new ApiResponse(201, "Reason item created successfully", data));
});

export const getWhyExhibitReasonsById = asyncHandler(async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const data = await getWhyExhibitReasonsByIdService(id);
  res.status(200).json(new ApiResponse(200, "Reason item fetched successfully", data));
});

export const updateWhyExhibitReasonsById = asyncHandler(async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const data = await updateWhyExhibitReasonsByIdService(id, req.body, req.files);
  res.status(200).json(new ApiResponse(200, "Reason item updated successfully", data));
});

export const deleteWhyExhibitReasonsById = asyncHandler(async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const data = await deleteWhyExhibitReasonsByIdService(id);
  res.status(200).json(new ApiResponse(200, "Reason item deleted successfully", data));
});
