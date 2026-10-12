import { Request, Response } from "express";
import asyncHandler from "../../../../../utils/asyncHandler";
import { ApiResponse } from "../../../../../utils/ApiResponse";
import {
  createAdvisoryNominationService,
  deleteAdvisoryNominationService,
  getAdvisoryNominationService,
  listAdvisoryNominationsService,
  updateAdvisoryNominationService,
} from "./advisoryNomination.service";

const idParam = (req: Request) => String(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id);

// POST /api/advisory-nominations — website form
export const submitAdvisoryNomination = asyncHandler(async (req: Request, res: Response) => {
  const data = await createAdvisoryNominationService(req.body);
  res.status(201).json(new ApiResponse(201, "Thank you! Your nomination has been submitted.", { _id: data._id, status: data.status }));
});

// GET /api/advisory-nominations — admin list (?status=&search=)
export const listAdvisoryNominations = asyncHandler(async (req: Request, res: Response) => {
  res.status(200).json(new ApiResponse(200, "Advisory nominations fetched", await listAdvisoryNominationsService(req.query)));
});

export const getAdvisoryNomination = asyncHandler(async (req: Request, res: Response) => {
  res.status(200).json(new ApiResponse(200, "Advisory nomination fetched", await getAdvisoryNominationService(idParam(req))));
});

// PATCH /api/advisory-nominations/:id { status?, adminNote? }
export const updateAdvisoryNomination = asyncHandler(async (req: Request, res: Response) => {
  const by = String((req as any).user?.name || (req as any).user?.email || "Admin");
  res.status(200).json(new ApiResponse(200, "Nomination updated", await updateAdvisoryNominationService(idParam(req), req.body, by)));
});

export const deleteAdvisoryNomination = asyncHandler(async (req: Request, res: Response) => {
  await deleteAdvisoryNominationService(idParam(req));
  res.status(200).json(new ApiResponse(200, "Nomination deleted", null));
});
