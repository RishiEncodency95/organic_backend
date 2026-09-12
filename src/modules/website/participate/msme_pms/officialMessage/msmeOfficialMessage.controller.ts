import { Request, Response } from "express";
import asyncHandler from "../../../../../utils/asyncHandler";
import { ApiResponse } from "../../../../../utils/ApiResponse";
import {
  getMsmeOfficialMessageService,
  updateMsmeOfficialMessageService,
} from "./msmeOfficialMessage.service";

export const getMsmeOfficialMessage = asyncHandler(async (_req: Request, res: Response) => {
  const data = await getMsmeOfficialMessageService();
  res.status(200).json(new ApiResponse(200, "MSME Official Message fetched successfully", data));
});

export const updateMsmeOfficialMessage = asyncHandler(async (req: Request, res: Response) => {
  const data = await updateMsmeOfficialMessageService(req.body);
  res.status(200).json(new ApiResponse(200, "MSME Official Message updated successfully", data));
});
