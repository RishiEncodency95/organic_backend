import { Request, Response } from "express";
import asyncHandler from "../../../../../utils/asyncHandler";
import { ApiResponse } from "../../../../../utils/ApiResponse";
import {
  getAdvisoryBoardGridService,
  updateAdvisoryBoardGridService,
} from "./advisoryBoardGrid.service";

export const getAdvisoryBoardGrid = asyncHandler(async (_req: Request, res: Response) => {
  const data = await getAdvisoryBoardGridService();
  res.status(200).json(new ApiResponse(200, "Advisory Board Grid fetched successfully", data));
});

export const updateAdvisoryBoardGrid = asyncHandler(async (req: Request, res: Response) => {
  const data = await updateAdvisoryBoardGridService(req.body);
  res.status(200).json(new ApiResponse(200, "Advisory Board Grid updated successfully", data));
});
