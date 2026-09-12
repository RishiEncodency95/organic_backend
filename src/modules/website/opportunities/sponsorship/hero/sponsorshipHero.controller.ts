import { Request, Response } from "express";
import asyncHandler from "../../../../../utils/asyncHandler";
import { ApiResponse } from "../../../../../utils/ApiResponse";
import {
  getSponsorshipHeroService,
  updateSponsorshipHeroService,
  createSponsorshipHeroService,
  getAllSponsorshipHeroService,
  getSponsorshipHeroByIdService,
  updateSponsorshipHeroByIdService,
  deleteSponsorshipHeroByIdService,
} from "./sponsorshipHero.service";

export const getSponsorshipHero = asyncHandler(async (_req: Request, res: Response) => {
  const data = await getSponsorshipHeroService();
  res.status(200).json(new ApiResponse(200, "Sponsorship Hero fetched successfully", data));
});

export const updateSponsorshipHero = asyncHandler(async (req: Request, res: Response) => {
  const data = await updateSponsorshipHeroService(req.body, req.files);
  res.status(200).json(new ApiResponse(200, "Sponsorship Hero updated successfully", data));
});

export const createSponsorshipHero = asyncHandler(async (req: Request, res: Response) => {
  const data = await createSponsorshipHeroService(req.body, req.files);
  res.status(201).json(new ApiResponse(201, "Sponsorship Hero created successfully", data));
});

export const getAllSponsorshipHero = asyncHandler(async (_req: Request, res: Response) => {
  const data = await getAllSponsorshipHeroService();
  res.status(200).json(new ApiResponse(200, "Sponsorship Hero list fetched successfully", data));
});

export const getSponsorshipHeroById = asyncHandler(async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const data = await getSponsorshipHeroByIdService(id);
  res.status(200).json(new ApiResponse(200, "Sponsorship Hero fetched successfully", data));
});

export const updateSponsorshipHeroById = asyncHandler(async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const data = await updateSponsorshipHeroByIdService(id, req.body, req.files);
  res.status(200).json(new ApiResponse(200, "Sponsorship Hero updated successfully", data));
});

export const deleteSponsorshipHeroById = asyncHandler(async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const data = await deleteSponsorshipHeroByIdService(id);
  res.status(200).json(new ApiResponse(200, "Sponsorship Hero deleted successfully", data));
});
