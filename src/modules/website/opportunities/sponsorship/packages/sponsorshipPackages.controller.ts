import { Request, Response } from "express";
import asyncHandler from "../../../../../utils/asyncHandler";
import { ApiResponse } from "../../../../../utils/ApiResponse";
import {
  getSponsorshipPackagesService,
  updateSponsorshipPackagesService,
  createSponsorshipPackagesService,
  getAllSponsorshipPackagesService,
  getSponsorshipPackagesByIdService,
  updateSponsorshipPackagesByIdService,
  deleteSponsorshipPackagesByIdService,
} from "./sponsorshipPackages.service";

export const getSponsorshipPackages = asyncHandler(async (_req: Request, res: Response) => {
  const data = await getSponsorshipPackagesService();
  res.status(200).json(new ApiResponse(200, "Sponsorship Packages fetched successfully", data));
});

export const updateSponsorshipPackages = asyncHandler(async (req: Request, res: Response) => {
  const data = await updateSponsorshipPackagesService(req.body, req.files);
  res.status(200).json(new ApiResponse(200, "Sponsorship Packages updated successfully", data));
});

export const createSponsorshipPackages = asyncHandler(async (req: Request, res: Response) => {
  const data = await createSponsorshipPackagesService(req.body, req.files);
  res.status(201).json(new ApiResponse(201, "Sponsorship Packages created successfully", data));
});

export const getAllSponsorshipPackages = asyncHandler(async (_req: Request, res: Response) => {
  const data = await getAllSponsorshipPackagesService();
  res.status(200).json(new ApiResponse(200, "Sponsorship Packages list fetched successfully", data));
});

export const getSponsorshipPackagesById = asyncHandler(async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const data = await getSponsorshipPackagesByIdService(id);
  res.status(200).json(new ApiResponse(200, "Sponsorship Packages fetched successfully", data));
});

export const updateSponsorshipPackagesById = asyncHandler(async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const data = await updateSponsorshipPackagesByIdService(id, req.body, req.files);
  res.status(200).json(new ApiResponse(200, "Sponsorship Packages updated successfully", data));
});

export const deleteSponsorshipPackagesById = asyncHandler(async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const data = await deleteSponsorshipPackagesByIdService(id);
  res.status(200).json(new ApiResponse(200, "Sponsorship Packages deleted successfully", data));
});
