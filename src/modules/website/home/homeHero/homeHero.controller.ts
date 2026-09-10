import { Request, Response } from "express";
import asyncHandler from "../../../../utils/asyncHandler";
import { ApiResponse } from "../../../../utils/ApiResponse";
import {
  createHomeHeroService,
  getAllHomeHeroService,
  getHomeHeroByIdService,
  updateHomeHeroByIdService,
  deleteHomeHeroByIdService,
  syncHomeHeroSlidesService,
} from "./homeHero.service";

export const createHomeHero = asyncHandler(async (req: Request, res: Response) => {
  const data = await createHomeHeroService(req.body, req.file);
  res.status(201).json(new ApiResponse(201, "Home Hero banner created successfully", data));
});

export const getAllHomeHero = asyncHandler(async (_req: Request, res: Response) => {
  const data = await getAllHomeHeroService();
  res.status(200).json(new ApiResponse(200, "Home Hero banners fetched successfully", data));
});

export const syncHomeHero = asyncHandler(async (req: Request, res: Response) => {
  const data = await syncHomeHeroSlidesService(req.body);
  res.status(200).json(new ApiResponse(200, "Home Hero slides synced successfully", data));
});

export const getHomeHeroById = asyncHandler(async (req: Request, res: Response) => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const data = await getHomeHeroByIdService(id);
  res.status(200).json(new ApiResponse(200, "Home Hero banner fetched successfully", data));
});

export const updateHomeHeroById = asyncHandler(async (req: Request, res: Response) => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const data = await updateHomeHeroByIdService(id, req.body, req.file);
  res.status(200).json(new ApiResponse(200, "Home Hero banner updated successfully", data));
});

export const deleteHomeHeroById = asyncHandler(async (req: Request, res: Response) => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const data = await deleteHomeHeroByIdService(id);
  res.status(200).json(new ApiResponse(200, "Home Hero banner deleted successfully", data));
});
