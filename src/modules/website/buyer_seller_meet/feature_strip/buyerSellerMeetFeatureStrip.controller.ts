import { Request, Response } from "express";
import asyncHandler from "../../../../utils/asyncHandler";
import { ApiResponse } from "../../../../utils/ApiResponse";
import {
  getBuyerSellerMeetFeatureStripService,
  updateBuyerSellerMeetFeatureStripService,
  createBuyerSellerMeetFeatureStripService,
  getAllBuyerSellerMeetFeatureStripService,
  getBuyerSellerMeetFeatureStripByIdService,
  updateBuyerSellerMeetFeatureStripByIdService,
  deleteBuyerSellerMeetFeatureStripByIdService,
} from "./buyerSellerMeetFeatureStrip.service";

export const getBuyerSellerMeetFeatureStrip = asyncHandler(async (_req: Request, res: Response) => {
  const data = await getBuyerSellerMeetFeatureStripService();
  res.status(200).json(new ApiResponse(200, "Buyer Seller Meet Feature Strip fetched successfully", data));
});

export const updateBuyerSellerMeetFeatureStrip = asyncHandler(async (req: Request, res: Response) => {
  const data = await updateBuyerSellerMeetFeatureStripService(req.body, req.files);
  res.status(200).json(new ApiResponse(200, "Buyer Seller Meet Feature Strip updated successfully", data));
});

export const createBuyerSellerMeetFeatureStrip = asyncHandler(async (req: Request, res: Response) => {
  const data = await createBuyerSellerMeetFeatureStripService(req.body, req.files);
  res.status(201).json(new ApiResponse(201, "Buyer Seller Meet Feature Strip created successfully", data));
});

export const getAllBuyerSellerMeetFeatureStrip = asyncHandler(async (_req: Request, res: Response) => {
  const data = await getAllBuyerSellerMeetFeatureStripService();
  res.status(200).json(new ApiResponse(200, "Buyer Seller Meet Feature Strip list fetched successfully", data));
});

export const getBuyerSellerMeetFeatureStripById = asyncHandler(async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const data = await getBuyerSellerMeetFeatureStripByIdService(id);
  res.status(200).json(new ApiResponse(200, "Buyer Seller Meet Feature Strip fetched successfully", data));
});

export const updateBuyerSellerMeetFeatureStripById = asyncHandler(async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const data = await updateBuyerSellerMeetFeatureStripByIdService(id, req.body, req.files);
  res.status(200).json(new ApiResponse(200, "Buyer Seller Meet Feature Strip updated successfully", data));
});

export const deleteBuyerSellerMeetFeatureStripById = asyncHandler(async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const data = await deleteBuyerSellerMeetFeatureStripByIdService(id);
  res.status(200).json(new ApiResponse(200, "Buyer Seller Meet Feature Strip deleted successfully", data));
});
