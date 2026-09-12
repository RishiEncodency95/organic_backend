import { Request, Response } from "express";
import asyncHandler from "../../../../../utils/asyncHandler";
import { ApiResponse } from "../../../../../utils/ApiResponse";
import {
  getWhyVisitBuyerSellerService,
  updateWhyVisitBuyerSellerService,
  createWhyVisitBuyerSellerService,
  getAllWhyVisitBuyerSellerService,
  getWhyVisitBuyerSellerByIdService,
  updateWhyVisitBuyerSellerByIdService,
  deleteWhyVisitBuyerSellerByIdService,
} from "./whyVisitBuyerSeller.service";

export const getWhyVisitBuyerSeller = asyncHandler(async (_req: Request, res: Response) => {
  const data = await getWhyVisitBuyerSellerService();
  res.status(200).json(new ApiResponse(200, "Why Visit Buyer Seller fetched successfully", data));
});

export const updateWhyVisitBuyerSeller = asyncHandler(async (req: Request, res: Response) => {
  const data = await updateWhyVisitBuyerSellerService(req.body, req.files);
  res.status(200).json(new ApiResponse(200, "Why Visit Buyer Seller updated successfully", data));
});

export const createWhyVisitBuyerSeller = asyncHandler(async (req: Request, res: Response) => {
  const data = await createWhyVisitBuyerSellerService(req.body, req.files);
  res.status(201).json(new ApiResponse(201, "Why Visit Buyer Seller created successfully", data));
});

export const getAllWhyVisitBuyerSeller = asyncHandler(async (_req: Request, res: Response) => {
  const data = await getAllWhyVisitBuyerSellerService();
  res.status(200).json(new ApiResponse(200, "Why Visit Buyer Seller list fetched successfully", data));
});

export const getWhyVisitBuyerSellerById = asyncHandler(async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const data = await getWhyVisitBuyerSellerByIdService(id);
  res.status(200).json(new ApiResponse(200, "Why Visit Buyer Seller fetched successfully", data));
});

export const updateWhyVisitBuyerSellerById = asyncHandler(async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const data = await updateWhyVisitBuyerSellerByIdService(id, req.body, req.files);
  res.status(200).json(new ApiResponse(200, "Why Visit Buyer Seller updated successfully", data));
});

export const deleteWhyVisitBuyerSellerById = asyncHandler(async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const data = await deleteWhyVisitBuyerSellerByIdService(id);
  res.status(200).json(new ApiResponse(200, "Why Visit Buyer Seller deleted successfully", data));
});
