import { Request, Response } from "express";
import asyncHandler from "../../../../../utils/asyncHandler";
import { ApiResponse } from "../../../../../utils/ApiResponse";
import {
  getAboutFaqService,
  updateAboutFaqService,
} from "./aboutFaq.service";

export const getAboutFaq = asyncHandler(async (_req: Request, res: Response) => {
  const data = await getAboutFaqService();
  res.status(200).json(new ApiResponse(200, "About FAQ fetched successfully", data));
});

export const updateAboutFaq = asyncHandler(async (req: Request, res: Response) => {
  const data = await updateAboutFaqService(req.body);
  res.status(200).json(new ApiResponse(200, "About FAQ updated successfully", data));
});
