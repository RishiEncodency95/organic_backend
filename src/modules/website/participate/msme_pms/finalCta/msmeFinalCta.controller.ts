import { Request, Response } from "express";
import asyncHandler from "../../../../../utils/asyncHandler";
import { ApiResponse } from "../../../../../utils/ApiResponse";
import { getMsmeFinalCtaService, updateMsmeFinalCtaService } from "./msmeFinalCta.service";

export const getMsmeFinalCta = asyncHandler(async (_req: Request, res: Response) => {
  const data = await getMsmeFinalCtaService();
  res.status(200).json(new ApiResponse(200, "MSME Final CTA fetched successfully", data));
});

export const updateMsmeFinalCta = asyncHandler(async (req: Request, res: Response) => {
  const data = await updateMsmeFinalCtaService(req.body);
  res.status(200).json(new ApiResponse(200, "MSME Final CTA updated successfully", data));
});
