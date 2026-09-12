import { Request, Response } from "express";
import asyncHandler from "../../../../../utils/asyncHandler";
import { ApiResponse } from "../../../../../utils/ApiResponse";
import {
  getEPromotionHeroService,
  updateEPromotionHeroService,
  createEPromotionHeroService,
  getAllEPromotionHeroService,
  getEPromotionHeroByIdService,
  updateEPromotionHeroByIdService,
  deleteEPromotionHeroByIdService,
} from "./epromotionHero.service";

export const getEPromotionHero = asyncHandler(async (_req: Request, res: Response) => {
  const data = await getEPromotionHeroService();
  res.status(200).json(new ApiResponse(200, "E-Promotion Hero fetched successfully", data));
});

export const updateEPromotionHero = asyncHandler(async (req: Request, res: Response) => {
  const data = await updateEPromotionHeroService(req.body, req.files);
  res.status(200).json(new ApiResponse(200, "E-Promotion Hero updated successfully", data));
});

export const createEPromotionHero = asyncHandler(async (req: Request, res: Response) => {
  const data = await createEPromotionHeroService(req.body, req.files);
  res.status(201).json(new ApiResponse(201, "E-Promotion Hero created successfully", data));
});

export const getAllEPromotionHero = asyncHandler(async (_req: Request, res: Response) => {
  const data = await getAllEPromotionHeroService();
  res.status(200).json(new ApiResponse(200, "E-Promotion Hero list fetched successfully", data));
});

export const getEPromotionHeroById = asyncHandler(async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const data = await getEPromotionHeroByIdService(id);
  res.status(200).json(new ApiResponse(200, "E-Promotion Hero fetched successfully", data));
});

export const updateEPromotionHeroById = asyncHandler(async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const data = await updateEPromotionHeroByIdService(id, req.body, req.files);
  res.status(200).json(new ApiResponse(200, "E-Promotion Hero updated successfully", data));
});

export const deleteEPromotionHeroById = asyncHandler(async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const data = await deleteEPromotionHeroByIdService(id);
  res.status(200).json(new ApiResponse(200, "E-Promotion Hero deleted successfully", data));
});
