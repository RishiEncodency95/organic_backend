import { Request, Response } from "express";
import asyncHandler from "../../../../utils/asyncHandler";
import { ApiResponse } from "../../../../utils/ApiResponse";
import {
  getBuyerSellerMeetWhoCanParticipateService,
  updateBuyerSellerMeetWhoCanParticipateService,
  createBuyerSellerMeetWhoCanParticipateService,
  getAllBuyerSellerMeetWhoCanParticipateService,
  getBuyerSellerMeetWhoCanParticipateByIdService,
  updateBuyerSellerMeetWhoCanParticipateByIdService,
  deleteBuyerSellerMeetWhoCanParticipateByIdService,
} from "./buyerSellerMeetWhoCanParticipate.service";

export const getBuyerSellerMeetWhoCanParticipate = asyncHandler(async (_req: Request, res: Response) => {
  const data = await getBuyerSellerMeetWhoCanParticipateService();
  res.status(200).json(new ApiResponse(200, "Buyer Seller Meet Who Can Participate fetched successfully", data));
});

export const updateBuyerSellerMeetWhoCanParticipate = asyncHandler(async (req: Request, res: Response) => {
  const data = await updateBuyerSellerMeetWhoCanParticipateService(req.body, req.files);
  res.status(200).json(new ApiResponse(200, "Buyer Seller Meet Who Can Participate updated successfully", data));
});

export const createBuyerSellerMeetWhoCanParticipate = asyncHandler(async (req: Request, res: Response) => {
  const data = await createBuyerSellerMeetWhoCanParticipateService(req.body, req.files);
  res.status(201).json(new ApiResponse(201, "Buyer Seller Meet Who Can Participate created successfully", data));
});

export const getAllBuyerSellerMeetWhoCanParticipate = asyncHandler(async (_req: Request, res: Response) => {
  const data = await getAllBuyerSellerMeetWhoCanParticipateService();
  res.status(200).json(new ApiResponse(200, "Buyer Seller Meet Who Can Participate list fetched successfully", data));
});

export const getBuyerSellerMeetWhoCanParticipateById = asyncHandler(async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const data = await getBuyerSellerMeetWhoCanParticipateByIdService(id);
  res.status(200).json(new ApiResponse(200, "Buyer Seller Meet Who Can Participate fetched successfully", data));
});

export const updateBuyerSellerMeetWhoCanParticipateById = asyncHandler(async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const data = await updateBuyerSellerMeetWhoCanParticipateByIdService(id, req.body, req.files);
  res.status(200).json(new ApiResponse(200, "Buyer Seller Meet Who Can Participate updated successfully", data));
});

export const deleteBuyerSellerMeetWhoCanParticipateById = asyncHandler(async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const data = await deleteBuyerSellerMeetWhoCanParticipateByIdService(id);
  res.status(200).json(new ApiResponse(200, "Buyer Seller Meet Who Can Participate deleted successfully", data));
});
