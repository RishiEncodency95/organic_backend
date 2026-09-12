import { Request, Response } from "express";
import asyncHandler from "../../../../utils/asyncHandler";
import { ApiResponse } from "../../../../utils/ApiResponse";
import {
  getBuyerSellerMeetAboutService,
  updateBuyerSellerMeetAboutService,
  createBuyerSellerMeetAboutService,
  getAllBuyerSellerMeetAboutService,
  getBuyerSellerMeetAboutByIdService,
  updateBuyerSellerMeetAboutByIdService,
  deleteBuyerSellerMeetAboutByIdService,
} from "./buyerSellerMeetAbout.service";

export const getBuyerSellerMeetAbout = asyncHandler(async (_req: Request, res: Response) => {
  const data = await getBuyerSellerMeetAboutService();
  res.status(200).json(new ApiResponse(200, "Buyer Seller Meet About fetched successfully", data));
});

export const updateBuyerSellerMeetAbout = asyncHandler(async (req: Request, res: Response) => {
  const data = await updateBuyerSellerMeetAboutService(req.body, req.files);
  res.status(200).json(new ApiResponse(200, "Buyer Seller Meet About updated successfully", data));
});

export const createBuyerSellerMeetAbout = asyncHandler(async (req: Request, res: Response) => {
  const data = await createBuyerSellerMeetAboutService(req.body, req.files);
  res.status(201).json(new ApiResponse(201, "Buyer Seller Meet About created successfully", data));
});

export const getAllBuyerSellerMeetAbout = asyncHandler(async (_req: Request, res: Response) => {
  const data = await getAllBuyerSellerMeetAboutService();
  res.status(200).json(new ApiResponse(200, "Buyer Seller Meet About list fetched successfully", data));
});

export const getBuyerSellerMeetAboutById = asyncHandler(async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const data = await getBuyerSellerMeetAboutByIdService(id);
  res.status(200).json(new ApiResponse(200, "Buyer Seller Meet About fetched successfully", data));
});

export const updateBuyerSellerMeetAboutById = asyncHandler(async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const data = await updateBuyerSellerMeetAboutByIdService(id, req.body, req.files);
  res.status(200).json(new ApiResponse(200, "Buyer Seller Meet About updated successfully", data));
});

export const deleteBuyerSellerMeetAboutById = asyncHandler(async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const data = await deleteBuyerSellerMeetAboutByIdService(id);
  res.status(200).json(new ApiResponse(200, "Buyer Seller Meet About deleted successfully", data));
});
