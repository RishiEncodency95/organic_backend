import { Request, Response } from "express";
import asyncHandler from "../../../../../utils/asyncHandler";
import { ApiResponse } from "../../../../../utils/ApiResponse";
import {
  getExhibitorListHeroService,
  updateExhibitorListHeroService,
  createExhibitorListHeroService,
  getAllExhibitorListHeroService,
  getExhibitorListHeroByIdService,
  updateExhibitorListHeroByIdService,
  deleteExhibitorListHeroByIdService,
} from "./exhibitorListHero.service";

export const getExhibitorListHero = asyncHandler(async (_req: Request, res: Response) => {
  const data = await getExhibitorListHeroService();
  res.status(200).json(new ApiResponse(200, "Exhibitor List Hero fetched successfully", data));
});

export const updateExhibitorListHero = asyncHandler(async (req: Request, res: Response) => {
  const data = await updateExhibitorListHeroService(req.body, req.files);
  res.status(200).json(new ApiResponse(200, "Exhibitor List Hero updated successfully", data));
});

export const createExhibitorListHero = asyncHandler(async (req: Request, res: Response) => {
  const data = await createExhibitorListHeroService(req.body, req.files);
  res.status(201).json(new ApiResponse(201, "Exhibitor List Hero created successfully", data));
});

export const getAllExhibitorListHero = asyncHandler(async (_req: Request, res: Response) => {
  const data = await getAllExhibitorListHeroService();
  res.status(200).json(new ApiResponse(200, "Exhibitor List Hero list fetched successfully", data));
});

export const getExhibitorListHeroById = asyncHandler(async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const data = await getExhibitorListHeroByIdService(id);
  res.status(200).json(new ApiResponse(200, "Exhibitor List Hero fetched successfully", data));
});

export const updateExhibitorListHeroById = asyncHandler(async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const data = await updateExhibitorListHeroByIdService(id, req.body, req.files);
  res.status(200).json(new ApiResponse(200, "Exhibitor List Hero updated successfully", data));
});

export const deleteExhibitorListHeroById = asyncHandler(async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const data = await deleteExhibitorListHeroByIdService(id);
  res.status(200).json(new ApiResponse(200, "Exhibitor List Hero deleted successfully", data));
});
