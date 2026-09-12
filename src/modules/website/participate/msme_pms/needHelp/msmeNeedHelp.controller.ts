import { Request, Response } from "express";
import asyncHandler from "../../../../../utils/asyncHandler";
import { ApiResponse } from "../../../../../utils/ApiResponse";
import { getMsmeNeedHelpService, updateMsmeNeedHelpService } from "./msmeNeedHelp.service";

export const getMsmeNeedHelp = asyncHandler(async (_req: Request, res: Response) => {
  const data = await getMsmeNeedHelpService();
  res.status(200).json(new ApiResponse(200, "MSME Need Help fetched successfully", data));
});

export const updateMsmeNeedHelp = asyncHandler(async (req: Request, res: Response) => {
  const data = await updateMsmeNeedHelpService(req.body);
  res.status(200).json(new ApiResponse(200, "MSME Need Help updated successfully", data));
});
