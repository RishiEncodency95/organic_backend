import { Request, Response } from "express";
import asyncHandler from "../../../../../utils/asyncHandler";
import { ApiResponse } from "../../../../../utils/ApiResponse";
import { getMsmeWhatsNextService, updateMsmeWhatsNextService } from "./msmeWhatsNext.service";

export const getMsmeWhatsNext = asyncHandler(async (_req: Request, res: Response) => {
  const data = await getMsmeWhatsNextService();
  res.status(200).json(new ApiResponse(200, "MSME What's Next fetched successfully", data));
});

export const updateMsmeWhatsNext = asyncHandler(async (req: Request, res: Response) => {
  const data = await updateMsmeWhatsNextService(req.body);
  res.status(200).json(new ApiResponse(200, "MSME What's Next updated successfully", data));
});
