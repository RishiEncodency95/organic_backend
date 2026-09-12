import { Request, Response } from "express";
import asyncHandler from "../../../../../utils/asyncHandler";
import { ApiResponse } from "../../../../../utils/ApiResponse";
import {
  getWhyExhibitHeroService,
  updateWhyExhibitHeroService,
  createWhyExhibitHeroService,
  getAllWhyExhibitHeroService,
  getWhyExhibitHeroByIdService,
  updateWhyExhibitHeroByIdService,
  deleteWhyExhibitHeroByIdService,
} from "./whyExhibitHero.service";

export const getWhyExhibitHero = asyncHandler(async (_req: Request, res: Response) => {
  const data = await getWhyExhibitHeroService();
  res.status(200).json(new ApiResponse(200, "Why Exhibit Hero fetched successfully", data));
});

export const updateWhyExhibitHero = asyncHandler(async (req: Request, res: Response) => {
  const data = await updateWhyExhibitHeroService(req.body, req.files);
  res.status(200).json(new ApiResponse(200, "Why Exhibit Hero updated successfully", data));
});

export const createWhyExhibitHero = asyncHandler(async (req: Request, res: Response) => {
  const data = await createWhyExhibitHeroService(req.body, req.files);
  res.status(201).json(new ApiResponse(201, "Why Exhibit Hero created successfully", data));
});

export const getAllWhyExhibitHero = asyncHandler(async (_req: Request, res: Response) => {
  const data = await getAllWhyExhibitHeroService();
  res.status(200).json(new ApiResponse(200, "Why Exhibit Hero list fetched successfully", data));
});

export const getWhyExhibitHeroById = asyncHandler(async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const data = await getWhyExhibitHeroByIdService(id);
  res.status(200).json(new ApiResponse(200, "Why Exhibit Hero fetched successfully", data));
});

export const updateWhyExhibitHeroById = asyncHandler(async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const data = await updateWhyExhibitHeroByIdService(id, req.body, req.files);
  res.status(200).json(new ApiResponse(200, "Why Exhibit Hero updated successfully", data));
});

export const deleteWhyExhibitHeroById = asyncHandler(async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const data = await deleteWhyExhibitHeroByIdService(id);
  res.status(200).json(new ApiResponse(200, "Why Exhibit Hero deleted successfully", data));
});
