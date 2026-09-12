import { Request, Response } from "express";
import asyncHandler from "../../../../../utils/asyncHandler";
import { ApiResponse } from "../../../../../utils/ApiResponse";
import {
  getMsmeFinancialAssistanceService,
  updateMsmeFinancialAssistanceService,
} from "./msmeFinancialAssistance.service";

export const getMsmeFinancialAssistance = asyncHandler(async (_req: Request, res: Response) => {
  const data = await getMsmeFinancialAssistanceService();
  res.status(200).json(new ApiResponse(200, "MSME Financial Assistance fetched successfully", data));
});

export const updateMsmeFinancialAssistance = asyncHandler(async (req: Request, res: Response) => {
  const data = await updateMsmeFinancialAssistanceService(req.body);
  res.status(200).json(new ApiResponse(200, "MSME Financial Assistance updated successfully", data));
});
