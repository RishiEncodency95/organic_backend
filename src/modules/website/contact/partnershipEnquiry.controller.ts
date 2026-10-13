import { Request, Response } from "express";
import asyncHandler from "../../../utils/asyncHandler";
import { ApiResponse } from "../../../utils/ApiResponse";
import {
  createPartnershipEnquiryService,
  createSponsorshipEnquiryService,
  createPartnerRegistrationService,
  createEPromotionEnquiryService,
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

export const submitSponsorshipEnquiry = asyncHandler(async (req: Request, res: Response) => {
  const data = await createSponsorshipEnquiryService(req.body);
  res.status(201).json(new ApiResponse(201, "Sponsorship enquiry submitted successfully", data));
});

// POST /partnership-enquiry/partner — the partner pages' "Partner with us" form
export const submitPartnerRegistration = asyncHandler(async (req: Request, res: Response) => {
  const data = await createPartnerRegistrationService(req.body);
  res.status(201).json(new ApiResponse(201, "Thank you! Your partner registration has been received.", { _id: data._id }));
});

// POST /partnership-enquiry/e-promotion — the E-Promotion page "Enquire now" popup
export const submitEPromotionEnquiry = asyncHandler(async (req: Request, res: Response) => {
  const data = await createEPromotionEnquiryService(req.body);
  res.status(201).json(new ApiResponse(201, "Thank you! Your enquiry has been received.", { _id: data._id }));
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
