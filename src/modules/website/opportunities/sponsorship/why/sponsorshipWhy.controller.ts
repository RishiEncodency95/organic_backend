import { Request, Response } from "express";
import asyncHandler from "../../../../../utils/asyncHandler";
import { ApiResponse } from "../../../../../utils/ApiResponse";
import {
  getSponsorshipWhyService,
  updateSponsorshipWhyService,
  createSponsorshipWhyService,
  getAllSponsorshipWhyService,
  getSponsorshipWhyByIdService,
  updateSponsorshipWhyByIdService,
  deleteSponsorshipWhyByIdService,
} from "./sponsorshipWhy.service";

export const getSponsorshipWhy = asyncHandler(async (_req: Request, res: Response) => {
  const data = await getSponsorshipWhyService();
  res.status(200).json(new ApiResponse(200, "Sponsorship Why fetched successfully", data));
});

export const updateSponsorshipWhy = asyncHandler(async (req: Request, res: Response) => {
  const data = await updateSponsorshipWhyService(req.body, req.files);
  res.status(200).json(new ApiResponse(200, "Sponsorship Why updated successfully", data));
});

export const createSponsorshipWhy = asyncHandler(async (req: Request, res: Response) => {
  const data = await createSponsorshipWhyService(req.body, req.files);
  res.status(201).json(new ApiResponse(201, "Sponsorship Why created successfully", data));
});

export const getAllSponsorshipWhy = asyncHandler(async (_req: Request, res: Response) => {
  const data = await getAllSponsorshipWhyService();
  res.status(200).json(new ApiResponse(200, "Sponsorship Why list fetched successfully", data));
});

export const getSponsorshipWhyById = asyncHandler(async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const data = await getSponsorshipWhyByIdService(id);
  res.status(200).json(new ApiResponse(200, "Sponsorship Why fetched successfully", data));
});

export const updateSponsorshipWhyById = asyncHandler(async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const data = await updateSponsorshipWhyByIdService(id, req.body, req.files);
  res.status(200).json(new ApiResponse(200, "Sponsorship Why updated successfully", data));
});

export const deleteSponsorshipWhyById = asyncHandler(async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const data = await deleteSponsorshipWhyByIdService(id);
  res.status(200).json(new ApiResponse(200, "Sponsorship Why deleted successfully", data));
});
