import { Request, Response } from "express";
import asyncHandler from "../../../../utils/asyncHandler";
import { ApiResponse } from "../../../../utils/ApiResponse";
import {
  getBuyerSellerMeetCtaService,
  updateBuyerSellerMeetCtaService,
  createBuyerSellerMeetCtaService,
  getAllBuyerSellerMeetCtaService,
  getBuyerSellerMeetCtaByIdService,
  updateBuyerSellerMeetCtaByIdService,
  deleteBuyerSellerMeetCtaByIdService,
} from "./buyerSellerMeetCta.service";

export const getBuyerSellerMeetCta = asyncHandler(async (_req: Request, res: Response) => {
  const data = await getBuyerSellerMeetCtaService();
  res.status(200).json(new ApiResponse(200, "Buyer Seller Meet CTA fetched successfully", data));
});

export const updateBuyerSellerMeetCta = asyncHandler(async (req: Request, res: Response) => {
  const data = await updateBuyerSellerMeetCtaService(req.body, req.files);
  res.status(200).json(new ApiResponse(200, "Buyer Seller Meet CTA updated successfully", data));
});

export const createBuyerSellerMeetCta = asyncHandler(async (req: Request, res: Response) => {
  const data = await createBuyerSellerMeetCtaService(req.body, req.files);
  res.status(201).json(new ApiResponse(201, "Buyer Seller Meet CTA created successfully", data));
});

export const getAllBuyerSellerMeetCta = asyncHandler(async (_req: Request, res: Response) => {
  const data = await getAllBuyerSellerMeetCtaService();
  res.status(200).json(new ApiResponse(200, "Buyer Seller Meet CTA list fetched successfully", data));
});

export const getBuyerSellerMeetCtaById = asyncHandler(async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const data = await getBuyerSellerMeetCtaByIdService(id);
  res.status(200).json(new ApiResponse(200, "Buyer Seller Meet CTA fetched successfully", data));
});

export const updateBuyerSellerMeetCtaById = asyncHandler(async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const data = await updateBuyerSellerMeetCtaByIdService(id, req.body, req.files);
  res.status(200).json(new ApiResponse(200, "Buyer Seller Meet CTA updated successfully", data));
});

export const deleteBuyerSellerMeetCtaById = asyncHandler(async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const data = await deleteBuyerSellerMeetCtaByIdService(id);
  res.status(200).json(new ApiResponse(200, "Buyer Seller Meet CTA deleted successfully", data));
});
