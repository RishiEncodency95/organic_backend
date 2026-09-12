import { Request, Response } from "express";
import asyncHandler from "../../../../../utils/asyncHandler";
import { ApiResponse } from "../../../../../utils/ApiResponse";
import { getMsmeSupportCoverService, updateMsmeSupportCoverService } from "./msmeSupportCover.service";

export const getMsmeSupportCover = asyncHandler(async (_req: Request, res: Response) => {
  const data = await getMsmeSupportCoverService();
  res.status(200).json(new ApiResponse(200, "MSME Support Cover fetched successfully", data));
});

export const updateMsmeSupportCover = asyncHandler(async (req: Request, res: Response) => {
  const data = await updateMsmeSupportCoverService(req.body);
  res.status(200).json(new ApiResponse(200, "MSME Support Cover updated successfully", data));
});
