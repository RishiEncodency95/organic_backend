import { Request, Response } from "express";
import asyncHandler from "../../../../../utils/asyncHandler";
import { ApiResponse } from "../../../../../utils/ApiResponse";
import {
  getPartnershipHeroService,
  updatePartnershipHeroService,
  createPartnershipHeroService,
  getAllPartnershipHeroService,
  getPartnershipHeroByIdService,
  updatePartnershipHeroByIdService,
  deletePartnershipHeroByIdService,
} from "./partnershipHero.service";

export const getPartnershipHero = asyncHandler(async (_req: Request, res: Response) => {
  const data = await getPartnershipHeroService();
  res.status(200).json(new ApiResponse(200, "Partnership Hero fetched successfully", data));
});

export const updatePartnershipHero = asyncHandler(async (req: Request, res: Response) => {
  const data = await updatePartnershipHeroService(req.body, req.files);
  res.status(200).json(new ApiResponse(200, "Partnership Hero updated successfully", data));
});

export const createPartnershipHero = asyncHandler(async (req: Request, res: Response) => {
  const data = await createPartnershipHeroService(req.body, req.files);
  res.status(201).json(new ApiResponse(201, "Partnership Hero created successfully", data));
});

export const getAllPartnershipHero = asyncHandler(async (_req: Request, res: Response) => {
  const data = await getAllPartnershipHeroService();
  res.status(200).json(new ApiResponse(200, "Partnership Hero list fetched successfully", data));
});

export const getPartnershipHeroById = asyncHandler(async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const data = await getPartnershipHeroByIdService(id);
  res.status(200).json(new ApiResponse(200, "Partnership Hero fetched successfully", data));
});

export const updatePartnershipHeroById = asyncHandler(async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const data = await updatePartnershipHeroByIdService(id, req.body, req.files);
  res.status(200).json(new ApiResponse(200, "Partnership Hero updated successfully", data));
});

export const deletePartnershipHeroById = asyncHandler(async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const data = await deletePartnershipHeroByIdService(id);
  res.status(200).json(new ApiResponse(200, "Partnership Hero deleted successfully", data));
});
