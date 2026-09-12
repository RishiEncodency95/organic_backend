import { Request, Response } from "express";
import asyncHandler from "../../../../utils/asyncHandler";
import { ApiResponse } from "../../../../utils/ApiResponse";
import {
  getBuyerSellerMeetConnectWithService,
  updateBuyerSellerMeetConnectWithService,
  createBuyerSellerMeetConnectWithService,
  getAllBuyerSellerMeetConnectWithService,
  getBuyerSellerMeetConnectWithByIdService,
  updateBuyerSellerMeetConnectWithByIdService,
  deleteBuyerSellerMeetConnectWithByIdService,
} from "./buyerSellerMeetConnectWith.service";

export const getBuyerSellerMeetConnectWith = asyncHandler(async (_req: Request, res: Response) => {
  const data = await getBuyerSellerMeetConnectWithService();
  res.status(200).json(new ApiResponse(200, "Buyer Seller Meet Connect With fetched successfully", data));
});

export const updateBuyerSellerMeetConnectWith = asyncHandler(async (req: Request, res: Response) => {
  const data = await updateBuyerSellerMeetConnectWithService(req.body, req.files);
  res.status(200).json(new ApiResponse(200, "Buyer Seller Meet Connect With updated successfully", data));
});

export const createBuyerSellerMeetConnectWith = asyncHandler(async (req: Request, res: Response) => {
  const data = await createBuyerSellerMeetConnectWithService(req.body, req.files);
  res.status(201).json(new ApiResponse(201, "Buyer Seller Meet Connect With created successfully", data));
});

export const getAllBuyerSellerMeetConnectWith = asyncHandler(async (_req: Request, res: Response) => {
  const data = await getAllBuyerSellerMeetConnectWithService();
  res.status(200).json(new ApiResponse(200, "Buyer Seller Meet Connect With list fetched successfully", data));
});

export const getBuyerSellerMeetConnectWithById = asyncHandler(async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const data = await getBuyerSellerMeetConnectWithByIdService(id);
  res.status(200).json(new ApiResponse(200, "Buyer Seller Meet Connect With fetched successfully", data));
});

export const updateBuyerSellerMeetConnectWithById = asyncHandler(async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const data = await updateBuyerSellerMeetConnectWithByIdService(id, req.body, req.files);
  res.status(200).json(new ApiResponse(200, "Buyer Seller Meet Connect With updated successfully", data));
});

export const deleteBuyerSellerMeetConnectWithById = asyncHandler(async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const data = await deleteBuyerSellerMeetConnectWithByIdService(id);
  res.status(200).json(new ApiResponse(200, "Buyer Seller Meet Connect With deleted successfully", data));
});
