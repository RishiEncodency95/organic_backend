import { Request, Response } from "express";
import asyncHandler from "../../../../../utils/asyncHandler";
import { ApiResponse } from "../../../../../utils/ApiResponse";
import {
  getAboutStripService,
  updateAboutStripService,
} from "./aboutStrip.service";

export const getAboutStrip = asyncHandler(async (_req: Request, res: Response) => {
  const data = await getAboutStripService();
  res.status(200).json(new ApiResponse(200, "About Strip fetched successfully", data));
});

export const updateAboutStrip = asyncHandler(async (req: Request, res: Response) => {
  const data = await updateAboutStripService(req.body);
  res.status(200).json(new ApiResponse(200, "About Strip updated successfully", data));
});
