import { Request, Response } from "express";
import asyncHandler from "../../../../utils/asyncHandler";
import { ApiResponse } from "../../../../utils/ApiResponse";
import {
  getBuyerSellerMeetHowItWorksService,
  updateBuyerSellerMeetHowItWorksService,
  createBuyerSellerMeetHowItWorksService,
  getAllBuyerSellerMeetHowItWorksService,
  getBuyerSellerMeetHowItWorksByIdService,
  updateBuyerSellerMeetHowItWorksByIdService,
  deleteBuyerSellerMeetHowItWorksByIdService,
} from "./buyerSellerMeetHowItWorks.service";

export const getBuyerSellerMeetHowItWorks = asyncHandler(async (_req: Request, res: Response) => {
  const data = await getBuyerSellerMeetHowItWorksService();
  res.status(200).json(new ApiResponse(200, "Buyer Seller Meet How It Works fetched successfully", data));
});

export const updateBuyerSellerMeetHowItWorks = asyncHandler(async (req: Request, res: Response) => {
  const data = await updateBuyerSellerMeetHowItWorksService(req.body, req.files);
  res.status(200).json(new ApiResponse(200, "Buyer Seller Meet How It Works updated successfully", data));
});

export const createBuyerSellerMeetHowItWorks = asyncHandler(async (req: Request, res: Response) => {
  const data = await createBuyerSellerMeetHowItWorksService(req.body, req.files);
  res.status(201).json(new ApiResponse(201, "Buyer Seller Meet How It Works created successfully", data));
});

export const getAllBuyerSellerMeetHowItWorks = asyncHandler(async (_req: Request, res: Response) => {
  const data = await getAllBuyerSellerMeetHowItWorksService();
  res.status(200).json(new ApiResponse(200, "Buyer Seller Meet How It Works list fetched successfully", data));
});

export const getBuyerSellerMeetHowItWorksById = asyncHandler(async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const data = await getBuyerSellerMeetHowItWorksByIdService(id);
  res.status(200).json(new ApiResponse(200, "Buyer Seller Meet How It Works fetched successfully", data));
});

export const updateBuyerSellerMeetHowItWorksById = asyncHandler(async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const data = await updateBuyerSellerMeetHowItWorksByIdService(id, req.body, req.files);
  res.status(200).json(new ApiResponse(200, "Buyer Seller Meet How It Works updated successfully", data));
});

export const deleteBuyerSellerMeetHowItWorksById = asyncHandler(async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const data = await deleteBuyerSellerMeetHowItWorksByIdService(id);
  res.status(200).json(new ApiResponse(200, "Buyer Seller Meet How It Works deleted successfully", data));
});
