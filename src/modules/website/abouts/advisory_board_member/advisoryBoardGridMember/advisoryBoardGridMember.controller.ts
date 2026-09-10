import { Request, Response } from "express";
import asyncHandler from "../../../../../utils/asyncHandler";
import { ApiResponse } from "../../../../../utils/ApiResponse";
import {
  createAdvisoryBoardGridMemberService,
  getAllAdvisoryBoardGridMembersService,
  getAdvisoryBoardGridMemberByIdService,
  updateAdvisoryBoardGridMemberByIdService,
  deleteAdvisoryBoardGridMemberByIdService,
} from "./advisoryBoardGridMember.service";

export const createAdvisoryBoardGridMember = asyncHandler(async (req: Request, res: Response) => {
  const data = await createAdvisoryBoardGridMemberService(req.body, req.file);
  res.status(201).json(new ApiResponse(201, "Advisory Board Member created successfully", data));
});

export const getAdvisoryBoardGridMembers = asyncHandler(async (_req: Request, res: Response) => {
  const data = await getAllAdvisoryBoardGridMembersService();
  res.status(200).json(new ApiResponse(200, "Advisory Board Members fetched successfully", data));
});

export const getAdvisoryBoardGridMemberById = asyncHandler(async (req: Request, res: Response) => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const data = await getAdvisoryBoardGridMemberByIdService(id);
  res.status(200).json(new ApiResponse(200, "Advisory Board Member fetched successfully", data));
});

export const updateAdvisoryBoardGridMember = asyncHandler(async (req: Request, res: Response) => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const data = await updateAdvisoryBoardGridMemberByIdService(id, req.body, req.file);
  res.status(200).json(new ApiResponse(200, "Advisory Board Member updated successfully", data));
});

export const deleteAdvisoryBoardGridMember = asyncHandler(async (req: Request, res: Response) => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const data = await deleteAdvisoryBoardGridMemberByIdService(id);
  res.status(200).json(new ApiResponse(200, "Advisory Board Member deleted successfully", data));
});
