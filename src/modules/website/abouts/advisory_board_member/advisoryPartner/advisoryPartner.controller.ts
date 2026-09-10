import { Request, Response } from "express";
import asyncHandler from "../../../../../utils/asyncHandler";
import { ApiResponse } from "../../../../../utils/ApiResponse";
import {
  getAdvisoryPartnerService,
  updateAdvisoryPartnerService,
} from "./advisoryPartner.service";

export const getAdvisoryPartner = asyncHandler(async (_req: Request, res: Response) => {
  const data = await getAdvisoryPartnerService();
  res.status(200).json(new ApiResponse(200, "Advisory Partner fetched successfully", data));
});

export const updateAdvisoryPartner = asyncHandler(async (req: Request, res: Response) => {
  const data = await updateAdvisoryPartnerService(req.body);
  res.status(200).json(new ApiResponse(200, "Advisory Partner updated successfully", data));
});
