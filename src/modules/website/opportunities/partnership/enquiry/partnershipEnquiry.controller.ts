import { Request, Response } from "express";
import asyncHandler from "../../../../../utils/asyncHandler";
import { ApiResponse } from "../../../../../utils/ApiResponse";
import {
  getPartnershipEnquiryService,
  updatePartnershipEnquiryService,
  createPartnershipEnquiryService,
  getAllPartnershipEnquiryService,
  getPartnershipEnquiryByIdService,
  updatePartnershipEnquiryByIdService,
  deletePartnershipEnquiryByIdService,
} from "./partnershipEnquiry.service";

export const getPartnershipEnquiry = asyncHandler(async (_req: Request, res: Response) => {
  const data = await getPartnershipEnquiryService();
  res.status(200).json(new ApiResponse(200, "Partnership Enquiry fetched successfully", data));
});

export const updatePartnershipEnquiry = asyncHandler(async (req: Request, res: Response) => {
  const data = await updatePartnershipEnquiryService(req.body, req.files);
  res.status(200).json(new ApiResponse(200, "Partnership Enquiry updated successfully", data));
});

export const createPartnershipEnquiry = asyncHandler(async (req: Request, res: Response) => {
  const data = await createPartnershipEnquiryService(req.body, req.files);
  res.status(201).json(new ApiResponse(201, "Partnership Enquiry created successfully", data));
});

export const getAllPartnershipEnquiry = asyncHandler(async (_req: Request, res: Response) => {
  const data = await getAllPartnershipEnquiryService();
  res.status(200).json(new ApiResponse(200, "Partnership Enquiry list fetched successfully", data));
});

export const getPartnershipEnquiryById = asyncHandler(async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const data = await getPartnershipEnquiryByIdService(id);
  res.status(200).json(new ApiResponse(200, "Partnership Enquiry fetched successfully", data));
});

export const updatePartnershipEnquiryById = asyncHandler(async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const data = await updatePartnershipEnquiryByIdService(id, req.body, req.files);
  res.status(200).json(new ApiResponse(200, "Partnership Enquiry updated successfully", data));
});

export const deletePartnershipEnquiryById = asyncHandler(async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const data = await deletePartnershipEnquiryByIdService(id);
  res.status(200).json(new ApiResponse(200, "Partnership Enquiry deleted successfully", data));
});
