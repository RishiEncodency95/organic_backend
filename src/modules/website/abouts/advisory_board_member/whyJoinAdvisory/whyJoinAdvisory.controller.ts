import { Request, Response } from "express";
import asyncHandler from "../../../../../utils/asyncHandler";
import { ApiResponse } from "../../../../../utils/ApiResponse";
import {
  getWhyJoinAdvisoryService,
  updateWhyJoinAdvisoryService,
} from "./whyJoinAdvisory.service";

export const getWhyJoinAdvisory = asyncHandler(async (_req: Request, res: Response) => {
  const data = await getWhyJoinAdvisoryService();
  res.status(200).json(new ApiResponse(200, "Why Join Advisory fetched successfully", data));
});

export const updateWhyJoinAdvisory = asyncHandler(async (req: Request, res: Response) => {
  const data = await updateWhyJoinAdvisoryService(req.body);
  res.status(200).json(new ApiResponse(200, "Why Join Advisory updated successfully", data));
});
