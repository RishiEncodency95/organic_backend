import { Request, Response } from "express";
import asyncHandler from "../../../../../utils/asyncHandler";
import { ApiResponse } from "../../../../../utils/ApiResponse";
import {
  getSponsorshipContactService,
  updateSponsorshipContactService,
  createSponsorshipContactService,
  getAllSponsorshipContactService,
  getSponsorshipContactByIdService,
  updateSponsorshipContactByIdService,
  deleteSponsorshipContactByIdService,
} from "./sponsorshipContact.service";

export const getSponsorshipContact = asyncHandler(async (_req: Request, res: Response) => {
  const data = await getSponsorshipContactService();
  res.status(200).json(new ApiResponse(200, "Sponsorship Contact fetched successfully", data));
});

export const updateSponsorshipContact = asyncHandler(async (req: Request, res: Response) => {
  const data = await updateSponsorshipContactService(req.body, req.files);
  res.status(200).json(new ApiResponse(200, "Sponsorship Contact updated successfully", data));
});

export const createSponsorshipContact = asyncHandler(async (req: Request, res: Response) => {
  const data = await createSponsorshipContactService(req.body, req.files);
  res.status(201).json(new ApiResponse(201, "Sponsorship Contact created successfully", data));
});

export const getAllSponsorshipContact = asyncHandler(async (_req: Request, res: Response) => {
  const data = await getAllSponsorshipContactService();
  res.status(200).json(new ApiResponse(200, "Sponsorship Contact list fetched successfully", data));
});

export const getSponsorshipContactById = asyncHandler(async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const data = await getSponsorshipContactByIdService(id);
  res.status(200).json(new ApiResponse(200, "Sponsorship Contact fetched successfully", data));
});

export const updateSponsorshipContactById = asyncHandler(async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const data = await updateSponsorshipContactByIdService(id, req.body, req.files);
  res.status(200).json(new ApiResponse(200, "Sponsorship Contact updated successfully", data));
});

export const deleteSponsorshipContactById = asyncHandler(async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const data = await deleteSponsorshipContactByIdService(id);
  res.status(200).json(new ApiResponse(200, "Sponsorship Contact deleted successfully", data));
});
