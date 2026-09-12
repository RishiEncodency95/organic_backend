import { Request, Response } from "express";
import asyncHandler from "../../../../../utils/asyncHandler";
import { ApiResponse } from "../../../../../utils/ApiResponse";
import {
  getWhyVisitWhoShouldService,
  updateWhyVisitWhoShouldService,
  createWhyVisitWhoShouldService,
  getAllWhyVisitWhoShouldService,
  getWhyVisitWhoShouldByIdService,
  updateWhyVisitWhoShouldByIdService,
  deleteWhyVisitWhoShouldByIdService,
} from "./whyVisitWhoShould.service";

export const getWhyVisitWhoShould = asyncHandler(async (_req: Request, res: Response) => {
  const data = await getWhyVisitWhoShouldService();
  res.status(200).json(new ApiResponse(200, "Why Visit Who Should fetched successfully", data));
});

export const updateWhyVisitWhoShould = asyncHandler(async (req: Request, res: Response) => {
  const data = await updateWhyVisitWhoShouldService(req.body, req.files);
  res.status(200).json(new ApiResponse(200, "Why Visit Who Should updated successfully", data));
});

export const createWhyVisitWhoShould = asyncHandler(async (req: Request, res: Response) => {
  const data = await createWhyVisitWhoShouldService(req.body, req.files);
  res.status(201).json(new ApiResponse(201, "Why Visit Who Should created successfully", data));
});

export const getAllWhyVisitWhoShould = asyncHandler(async (_req: Request, res: Response) => {
  const data = await getAllWhyVisitWhoShouldService();
  res.status(200).json(new ApiResponse(200, "Why Visit Who Should list fetched successfully", data));
});

export const getWhyVisitWhoShouldById = asyncHandler(async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const data = await getWhyVisitWhoShouldByIdService(id);
  res.status(200).json(new ApiResponse(200, "Why Visit Who Should fetched successfully", data));
});

export const updateWhyVisitWhoShouldById = asyncHandler(async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const data = await updateWhyVisitWhoShouldByIdService(id, req.body, req.files);
  res.status(200).json(new ApiResponse(200, "Why Visit Who Should updated successfully", data));
});

export const deleteWhyVisitWhoShouldById = asyncHandler(async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const data = await deleteWhyVisitWhoShouldByIdService(id);
  res.status(200).json(new ApiResponse(200, "Why Visit Who Should deleted successfully", data));
});
