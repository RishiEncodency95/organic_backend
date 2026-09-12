import { Request, Response } from "express";
import asyncHandler from "../../../../../utils/asyncHandler";
import { ApiResponse } from "../../../../../utils/ApiResponse";
import { getMsmeDocumentsService, updateMsmeDocumentsService } from "./msmeDocuments.service";

export const getMsmeDocuments = asyncHandler(async (_req: Request, res: Response) => {
  const data = await getMsmeDocumentsService();
  res.status(200).json(new ApiResponse(200, "MSME Documents fetched successfully", data));
});

export const updateMsmeDocuments = asyncHandler(async (req: Request, res: Response) => {
  const data = await updateMsmeDocumentsService(req.body);
  res.status(200).json(new ApiResponse(200, "MSME Documents updated successfully", data));
});
