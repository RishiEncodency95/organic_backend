import { Request, Response } from "express";
import asyncHandler from "../../../../utils/asyncHandler";
import { ApiResponse } from "../../../../utils/ApiResponse";
import {
  getBeyondExhibitionService,
  updateBeyondExhibitionService,
} from "./beyondExhibition.service";

export const getBeyondExhibition = asyncHandler(async (_req: Request, res: Response) => {
  const data = await getBeyondExhibitionService();
  res.status(200).json(new ApiResponse(200, "Beyond Exhibition fetched successfully", data));
});

export const updateBeyondExhibition = asyncHandler(async (req: Request, res: Response) => {
  const data = await updateBeyondExhibitionService(req.body, req.files);
  res.status(200).json(new ApiResponse(200, "Beyond Exhibition updated successfully", data));
});
