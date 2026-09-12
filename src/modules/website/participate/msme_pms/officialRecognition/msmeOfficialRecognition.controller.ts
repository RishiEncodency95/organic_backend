import { Request, Response } from "express";
import asyncHandler from "../../../../../utils/asyncHandler";
import { ApiResponse } from "../../../../../utils/ApiResponse";
import {
  getMsmeOfficialRecognitionService,
  updateMsmeOfficialRecognitionService,
} from "./msmeOfficialRecognition.service";

export const getMsmeOfficialRecognition = asyncHandler(async (_req: Request, res: Response) => {
  const data = await getMsmeOfficialRecognitionService();
  res.status(200).json(new ApiResponse(200, "MSME Official Recognition fetched successfully", data));
});

export const updateMsmeOfficialRecognition = asyncHandler(async (req: Request, res: Response) => {
  const data = await updateMsmeOfficialRecognitionService(req.body);
  res.status(200).json(new ApiResponse(200, "MSME Official Recognition updated successfully", data));
});
