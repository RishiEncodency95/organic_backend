import { Request, Response } from "express";
import asyncHandler from "../../../../../utils/asyncHandler";
import { ApiResponse } from "../../../../../utils/ApiResponse";
import {
  getSponsorshipBottomService,
  updateSponsorshipBottomService,
  createSponsorshipBottomService,
  getAllSponsorshipBottomService,
  getSponsorshipBottomByIdService,
  updateSponsorshipBottomByIdService,
  deleteSponsorshipBottomByIdService,
} from "./sponsorshipBottom.service";

export const getSponsorshipBottom = asyncHandler(async (_req: Request, res: Response) => {
  const data = await getSponsorshipBottomService();
  res.status(200).json(new ApiResponse(200, "Sponsorship Bottom fetched successfully", data));
});

export const updateSponsorshipBottom = asyncHandler(async (req: Request, res: Response) => {
  const data = await updateSponsorshipBottomService(req.body, req.files);
  res.status(200).json(new ApiResponse(200, "Sponsorship Bottom updated successfully", data));
});

export const createSponsorshipBottom = asyncHandler(async (req: Request, res: Response) => {
  const data = await createSponsorshipBottomService(req.body, req.files);
  res.status(201).json(new ApiResponse(201, "Sponsorship Bottom created successfully", data));
});

export const getAllSponsorshipBottom = asyncHandler(async (_req: Request, res: Response) => {
  const data = await getAllSponsorshipBottomService();
  res.status(200).json(new ApiResponse(200, "Sponsorship Bottom list fetched successfully", data));
});

export const getSponsorshipBottomById = asyncHandler(async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const data = await getSponsorshipBottomByIdService(id);
  res.status(200).json(new ApiResponse(200, "Sponsorship Bottom fetched successfully", data));
});

export const updateSponsorshipBottomById = asyncHandler(async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const data = await updateSponsorshipBottomByIdService(id, req.body, req.files);
  res.status(200).json(new ApiResponse(200, "Sponsorship Bottom updated successfully", data));
});

export const deleteSponsorshipBottomById = asyncHandler(async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const data = await deleteSponsorshipBottomByIdService(id);
  res.status(200).json(new ApiResponse(200, "Sponsorship Bottom deleted successfully", data));
});
