import { Request, Response } from "express";
import asyncHandler from "../../../utils/asyncHandler";
import { ApiResponse } from "../../../utils/ApiResponse";
import {
  createContactEnquiryService,
  getAllContactEnquiriesService,
  getContactEnquiryByIdService,
  updateContactEnquiryService,
  deleteContactEnquiryService,
} from "./contactEnquiry.service";

export const submitContactEnquiry = asyncHandler(
  async (req: Request, res: Response) => {
    const { name, email, phone, message } = req.body;
    if (!name || !email || !phone || !message) {
      res
        .status(400)
        .json(
          new ApiResponse(
            400,
            "Name, email, phone, and message are required fields",
            null
          )
        );
      return;
    }

    const data = await createContactEnquiryService(req.body);
    res
      .status(201)
      .json(
        new ApiResponse(201, "Contact enquiry submitted successfully", data)
      );
  }
);

export const getAllContactEnquiries = asyncHandler(
  async (req: Request, res: Response) => {
    const data = await getAllContactEnquiriesService(req.query);
    res
      .status(200)
      .json(new ApiResponse(200, "Contact enquiries fetched successfully", data));
  }
);

export const getContactEnquiryById = asyncHandler(
  async (req: Request, res: Response) => {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const data = await getContactEnquiryByIdService(id);
    if (!data) {
      res
        .status(404)
        .json(new ApiResponse(404, "Contact enquiry not found", null));
      return;
    }
    res
      .status(200)
      .json(
        new ApiResponse(
          200,
          "Contact enquiry details fetched successfully",
          data
        )
      );
  }
);

export const updateContactEnquiry = asyncHandler(
  async (req: Request, res: Response) => {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const data = await updateContactEnquiryService(id, req.body);
    res
      .status(200)
      .json(new ApiResponse(200, "Contact enquiry updated successfully", data));
  }
);

export const deleteContactEnquiry = asyncHandler(
  async (req: Request, res: Response) => {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const data = await deleteContactEnquiryService(id);
    res
      .status(200)
      .json(new ApiResponse(200, "Contact enquiry deleted successfully", data));
  }
);
