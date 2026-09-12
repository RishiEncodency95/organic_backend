import { Request, Response } from "express";
import asyncHandler from "../../../../../utils/asyncHandler";
import { ApiResponse } from "../../../../../utils/ApiResponse";
import {
  getWhyExhibitBuyersService,
  updateWhyExhibitBuyersService,
  createWhyExhibitBuyersService,
  getAllWhyExhibitBuyersService,
  getWhyExhibitBuyersByIdService,
  updateWhyExhibitBuyersByIdService,
  deleteWhyExhibitBuyersByIdService,
} from "./whyExhibitBuyers.service";

export const getWhyExhibitBuyers = asyncHandler(async (_req: Request, res: Response) => {
  const data = await getWhyExhibitBuyersService();
  res.status(200).json(new ApiResponse(200, "Why Exhibit Buyers fetched successfully", data));
});

export const updateWhyExhibitBuyers = asyncHandler(async (req: Request, res: Response) => {
  const data = await updateWhyExhibitBuyersService(req.body, req.files);
  res.status(200).json(new ApiResponse(200, "Why Exhibit Buyers updated successfully", data));
});

export const createWhyExhibitBuyers = asyncHandler(async (req: Request, res: Response) => {
  const data = await createWhyExhibitBuyersService(req.body, req.files);
  res.status(201).json(new ApiResponse(201, "Why Exhibit Buyers created successfully", data));
});

export const getAllWhyExhibitBuyers = asyncHandler(async (_req: Request, res: Response) => {
  const data = await getAllWhyExhibitBuyersService();
  res.status(200).json(new ApiResponse(200, "Why Exhibit Buyers list fetched successfully", data));
});

export const getWhyExhibitBuyersById = asyncHandler(async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const data = await getWhyExhibitBuyersByIdService(id);
  res.status(200).json(new ApiResponse(200, "Why Exhibit Buyers fetched successfully", data));
});

export const updateWhyExhibitBuyersById = asyncHandler(async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const data = await updateWhyExhibitBuyersByIdService(id, req.body, req.files);
  res.status(200).json(new ApiResponse(200, "Why Exhibit Buyers updated successfully", data));
});

export const deleteWhyExhibitBuyersById = asyncHandler(async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const data = await deleteWhyExhibitBuyersByIdService(id);
  res.status(200).json(new ApiResponse(200, "Why Exhibit Buyers deleted successfully", data));
});
