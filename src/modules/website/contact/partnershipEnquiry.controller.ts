import { Request, Response } from "express";
import asyncHandler from "../../../utils/asyncHandler";
import { ApiResponse } from "../../../utils/ApiResponse";
import {
  createPartnershipEnquiryService,
  getAllPartnershipEnquiriesService,
  getPartnershipEnquiryByIdService,
  updatePartnershipEnquiryService,
  deletePartnershipEnquiryService,
} from "./partnershipEnquiry.service";

const paramId = (req: Request) => (Array.isArray(req.params.id) ? req.params.id[0] : req.params.id);

export const submitPartnershipEnquiry = asyncHandler(async (req: Request, res: Response) => {
  const data = await createPartnershipEnquiryService(req.body);
  res.status(201).json(new ApiResponse(201, "Partnership enquiry submitted successfully", data));
});

export const getAllPartnershipEnquiries = asyncHandler(async (req: Request, res: Response) => {
  const data = await getAllPartnershipEnquiriesService(req.query);
  res.status(200).json(new ApiResponse(200, "Partnership enquiries fetched successfully", data));
});

export const getPartnershipEnquiryById = asyncHandler(async (req: Request, res: Response) => {
  const data = await getPartnershipEnquiryByIdService(paramId(req));
  if (!data) {
    res.status(404).json(new ApiResponse(404, "Partnership enquiry not found", null));
    return;
  }
  res.status(200).json(new ApiResponse(200, "Partnership enquiry fetched successfully", data));
});

export const updatePartnershipEnquiry = asyncHandler(async (req: Request, res: Response) => {
  const data = await updatePartnershipEnquiryService(paramId(req), req.body);
  if (!data) {
    res.status(404).json(new ApiResponse(404, "Partnership enquiry not found", null));
    return;
  }
  res.status(200).json(new ApiResponse(200, "Partnership enquiry updated successfully", data));
});

export const deletePartnershipEnquiry = asyncHandler(async (req: Request, res: Response) => {
  const data = await deletePartnershipEnquiryService(paramId(req));
  res.status(200).json(new ApiResponse(200, "Partnership enquiry deleted successfully", data));
});
