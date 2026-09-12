import { Request, Response } from "express";
import asyncHandler from "../../../../utils/asyncHandler";
import { ApiResponse } from "../../../../utils/ApiResponse";
import {
  getBuyerSellerMeetHeroService,
  updateBuyerSellerMeetHeroService,
  createBuyerSellerMeetHeroService,
  getAllBuyerSellerMeetHeroService,
  getBuyerSellerMeetHeroByIdService,
  updateBuyerSellerMeetHeroByIdService,
  deleteBuyerSellerMeetHeroByIdService,
} from "./buyerSellerMeetHero.service";

export const getBuyerSellerMeetHero = asyncHandler(async (_req: Request, res: Response) => {
  const data = await getBuyerSellerMeetHeroService();
  res.status(200).json(new ApiResponse(200, "Buyer Seller Meet Hero fetched successfully", data));
});

export const updateBuyerSellerMeetHero = asyncHandler(async (req: Request, res: Response) => {
  const data = await updateBuyerSellerMeetHeroService(req.body, req.files);
  res.status(200).json(new ApiResponse(200, "Buyer Seller Meet Hero updated successfully", data));
});

export const createBuyerSellerMeetHero = asyncHandler(async (req: Request, res: Response) => {
  const data = await createBuyerSellerMeetHeroService(req.body, req.files);
  res.status(201).json(new ApiResponse(201, "Buyer Seller Meet Hero created successfully", data));
});

export const getAllBuyerSellerMeetHero = asyncHandler(async (_req: Request, res: Response) => {
  const data = await getAllBuyerSellerMeetHeroService();
  res.status(200).json(new ApiResponse(200, "Buyer Seller Meet Hero list fetched successfully", data));
});

export const getBuyerSellerMeetHeroById = asyncHandler(async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const data = await getBuyerSellerMeetHeroByIdService(id);
  res.status(200).json(new ApiResponse(200, "Buyer Seller Meet Hero fetched successfully", data));
});

export const updateBuyerSellerMeetHeroById = asyncHandler(async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const data = await updateBuyerSellerMeetHeroByIdService(id, req.body, req.files);
  res.status(200).json(new ApiResponse(200, "Buyer Seller Meet Hero updated successfully", data));
});

export const deleteBuyerSellerMeetHeroById = asyncHandler(async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const data = await deleteBuyerSellerMeetHeroByIdService(id);
  res.status(200).json(new ApiResponse(200, "Buyer Seller Meet Hero deleted successfully", data));
});
