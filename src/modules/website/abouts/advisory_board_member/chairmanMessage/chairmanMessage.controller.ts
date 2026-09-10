import { Request, Response } from "express";
import asyncHandler from "../../../../../utils/asyncHandler";
import { ApiResponse } from "../../../../../utils/ApiResponse";
import {
  getChairmanMessageService,
  updateChairmanMessageService,
} from "./chairmanMessage.service";

export const getChairmanMessage = asyncHandler(async (_req: Request, res: Response) => {
  const data = await getChairmanMessageService();
  res.status(200).json(new ApiResponse(200, "Chairman Message fetched successfully", data));
});

export const updateChairmanMessage = asyncHandler(async (req: Request, res: Response) => {
  const data = await updateChairmanMessageService(req.body);
  res.status(200).json(new ApiResponse(200, "Chairman Message updated successfully", data));
});
