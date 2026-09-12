import { Request, Response } from "express";
import asyncHandler from "../../../../utils/asyncHandler";
import { ApiResponse } from "../../../../utils/ApiResponse";
import {
  getBuyerSellerMeetWhatToSourceService,
  updateBuyerSellerMeetWhatToSourceService,
  createBuyerSellerMeetWhatToSourceService,
  getAllBuyerSellerMeetWhatToSourceService,
  getBuyerSellerMeetWhatToSourceByIdService,
  updateBuyerSellerMeetWhatToSourceByIdService,
  deleteBuyerSellerMeetWhatToSourceByIdService,
} from "./buyerSellerMeetWhatToSource.service";

export const getBuyerSellerMeetWhatToSource = asyncHandler(async (_req: Request, res: Response) => {
  const data = await getBuyerSellerMeetWhatToSourceService();
  res.status(200).json(new ApiResponse(200, "Buyer Seller Meet What To Source fetched successfully", data));
});

export const updateBuyerSellerMeetWhatToSource = asyncHandler(async (req: Request, res: Response) => {
  const data = await updateBuyerSellerMeetWhatToSourceService(req.body, req.files);
  res.status(200).json(new ApiResponse(200, "Buyer Seller Meet What To Source updated successfully", data));
});

export const createBuyerSellerMeetWhatToSource = asyncHandler(async (req: Request, res: Response) => {
  const data = await createBuyerSellerMeetWhatToSourceService(req.body, req.files);
  res.status(201).json(new ApiResponse(201, "Buyer Seller Meet What To Source created successfully", data));
});

export const getAllBuyerSellerMeetWhatToSource = asyncHandler(async (_req: Request, res: Response) => {
  const data = await getAllBuyerSellerMeetWhatToSourceService();
  res.status(200).json(new ApiResponse(200, "Buyer Seller Meet What To Source list fetched successfully", data));
});

export const getBuyerSellerMeetWhatToSourceById = asyncHandler(async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const data = await getBuyerSellerMeetWhatToSourceByIdService(id);
  res.status(200).json(new ApiResponse(200, "Buyer Seller Meet What To Source fetched successfully", data));
});

export const updateBuyerSellerMeetWhatToSourceById = asyncHandler(async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const data = await updateBuyerSellerMeetWhatToSourceByIdService(id, req.body, req.files);
  res.status(200).json(new ApiResponse(200, "Buyer Seller Meet What To Source updated successfully", data));
});

export const deleteBuyerSellerMeetWhatToSourceById = asyncHandler(async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const data = await deleteBuyerSellerMeetWhatToSourceByIdService(id);
  res.status(200).json(new ApiResponse(200, "Buyer Seller Meet What To Source deleted successfully", data));
});
