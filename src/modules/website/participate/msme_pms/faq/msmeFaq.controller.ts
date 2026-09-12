import { Request, Response } from "express";
import asyncHandler from "../../../../../utils/asyncHandler";
import { ApiResponse } from "../../../../../utils/ApiResponse";
import { getMsmeFaqService, updateMsmeFaqService } from "./msmeFaq.service";

export const getMsmeFaq = asyncHandler(async (_req: Request, res: Response) => {
  const data = await getMsmeFaqService();
  res.status(200).json(new ApiResponse(200, "MSME FAQ fetched successfully", data));
});

export const updateMsmeFaq = asyncHandler(async (req: Request, res: Response) => {
  const data = await updateMsmeFaqService(req.body);
  res.status(200).json(new ApiResponse(200, "MSME FAQ updated successfully", data));
});
