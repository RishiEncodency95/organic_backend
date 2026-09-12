import { Request, Response } from "express";
import asyncHandler from "../../../../../utils/asyncHandler";
import { ApiResponse } from "../../../../../utils/ApiResponse";
import { getMsmeWhyParticipateService, updateMsmeWhyParticipateService } from "./msmeWhyParticipate.service";

export const getMsmeWhyParticipate = asyncHandler(async (_req: Request, res: Response) => {
  const data = await getMsmeWhyParticipateService();
  res.status(200).json(new ApiResponse(200, "MSME Why Participate fetched successfully", data));
});

export const updateMsmeWhyParticipate = asyncHandler(async (req: Request, res: Response) => {
  const data = await updateMsmeWhyParticipateService(req.body);
  res.status(200).json(new ApiResponse(200, "MSME Why Participate updated successfully", data));
});
