import { Request, Response } from "express";
import asyncHandler from "../../../../utils/asyncHandler";
import { ApiResponse } from "../../../../utils/ApiResponse";
import {
  getBuyerSellerMeetService,
  updateBuyerSellerMeetService,
} from "./buyerSellerMeet.service";

export const getBuyerSellerMeet = asyncHandler(async (_req: Request, res: Response) => {
  const data = await getBuyerSellerMeetService();
  res.status(200).json(new ApiResponse(200, "Buyer Seller Meet fetched successfully", data));
});

export const updateBuyerSellerMeet = asyncHandler(async (req: Request, res: Response) => {
  const data = await updateBuyerSellerMeetService(req.body, req.files);
  res.status(200).json(new ApiResponse(200, "Buyer Seller Meet updated successfully", data));
});
