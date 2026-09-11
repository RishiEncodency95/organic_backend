import { Request, Response } from "express";
import asyncHandler from "../../../../../utils/asyncHandler";
import { ApiResponse } from "../../../../../utils/ApiResponse";
import {
  getWhyVisitHeroService,
  updateWhyVisitHeroService,
  createWhyVisitHeroService,
  getAllWhyVisitHeroService,
  getWhyVisitHeroByIdService,
  updateWhyVisitHeroByIdService,
  deleteWhyVisitHeroByIdService,
} from "./whyVisitHero.service";

export const getWhyVisitHero = asyncHandler(async (_req: Request, res: Response) => {
  const data = await getWhyVisitHeroService();
  res.status(200).json(new ApiResponse(200, "Why Visit Hero fetched successfully", data));
});

export const updateWhyVisitHero = asyncHandler(async (req: Request, res: Response) => {
  const data = await updateWhyVisitHeroService(req.body, req.files);
  res.status(200).json(new ApiResponse(200, "Why Visit Hero updated successfully", data));
});

export const createWhyVisitHero = asyncHandler(async (req: Request, res: Response) => {
  const data = await createWhyVisitHeroService(req.body, req.files);
  res.status(201).json(new ApiResponse(201, "Why Visit Hero created successfully", data));
});

export const getAllWhyVisitHero = asyncHandler(async (_req: Request, res: Response) => {
  const data = await getAllWhyVisitHeroService();
  res.status(200).json(new ApiResponse(200, "Why Visit Hero list fetched successfully", data));
});

export const getWhyVisitHeroById = asyncHandler(async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const data = await getWhyVisitHeroByIdService(id);
  res.status(200).json(new ApiResponse(200, "Why Visit Hero fetched successfully", data));
});

export const updateWhyVisitHeroById = asyncHandler(async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const data = await updateWhyVisitHeroByIdService(id, req.body, req.files);
  res.status(200).json(new ApiResponse(200, "Why Visit Hero updated successfully", data));
});

export const deleteWhyVisitHeroById = asyncHandler(async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const data = await deleteWhyVisitHeroByIdService(id);
  res.status(200).json(new ApiResponse(200, "Why Visit Hero deleted successfully", data));
});
