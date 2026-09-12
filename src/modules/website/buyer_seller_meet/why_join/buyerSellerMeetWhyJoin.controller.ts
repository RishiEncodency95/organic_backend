import { Request, Response } from "express";
import asyncHandler from "../../../../utils/asyncHandler";
import { ApiResponse } from "../../../../utils/ApiResponse";
import {
  getBuyerSellerMeetWhyJoinService,
  updateBuyerSellerMeetWhyJoinService,
  createBuyerSellerMeetWhyJoinService,
  getAllBuyerSellerMeetWhyJoinService,
  getBuyerSellerMeetWhyJoinByIdService,
  updateBuyerSellerMeetWhyJoinByIdService,
  deleteBuyerSellerMeetWhyJoinByIdService,
} from "./buyerSellerMeetWhyJoin.service";

export const getBuyerSellerMeetWhyJoin = asyncHandler(async (_req: Request, res: Response) => {
  const data = await getBuyerSellerMeetWhyJoinService();
  res.status(200).json(new ApiResponse(200, "Buyer Seller Meet Why Join fetched successfully", data));
});

export const updateBuyerSellerMeetWhyJoin = asyncHandler(async (req: Request, res: Response) => {
  const data = await updateBuyerSellerMeetWhyJoinService(req.body, req.files);
  res.status(200).json(new ApiResponse(200, "Buyer Seller Meet Why Join updated successfully", data));
});

export const createBuyerSellerMeetWhyJoin = asyncHandler(async (req: Request, res: Response) => {
  const data = await createBuyerSellerMeetWhyJoinService(req.body, req.files);
  res.status(201).json(new ApiResponse(201, "Buyer Seller Meet Why Join created successfully", data));
});

export const getAllBuyerSellerMeetWhyJoin = asyncHandler(async (_req: Request, res: Response) => {
  const data = await getAllBuyerSellerMeetWhyJoinService();
  res.status(200).json(new ApiResponse(200, "Buyer Seller Meet Why Join list fetched successfully", data));
});

export const getBuyerSellerMeetWhyJoinById = asyncHandler(async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const data = await getBuyerSellerMeetWhyJoinByIdService(id);
  res.status(200).json(new ApiResponse(200, "Buyer Seller Meet Why Join fetched successfully", data));
});

export const updateBuyerSellerMeetWhyJoinById = asyncHandler(async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const data = await updateBuyerSellerMeetWhyJoinByIdService(id, req.body, req.files);
  res.status(200).json(new ApiResponse(200, "Buyer Seller Meet Why Join updated successfully", data));
});

export const deleteBuyerSellerMeetWhyJoinById = asyncHandler(async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const data = await deleteBuyerSellerMeetWhyJoinByIdService(id);
  res.status(200).json(new ApiResponse(200, "Buyer Seller Meet Why Join deleted successfully", data));
});
