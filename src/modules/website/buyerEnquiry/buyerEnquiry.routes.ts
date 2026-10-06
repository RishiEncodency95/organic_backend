import { Request, Response, Router } from "express";
import asyncHandler from "../../../utils/asyncHandler";
import { ApiResponse } from "../../../utils/ApiResponse";
import { protect } from "../../../middlewares/auth.middleware";
import {
  createBuyerEnquiryService,
  deleteBuyerEnquiryService,
  listBuyerEnquiriesService,
  updateBuyerEnquiryStatusService,
} from "./buyerEnquiry.service";

const router = Router();
const idParam = (req: Request) => String(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id);

// Website popup (WhatsApp OTP must be verified first, see buyerEnquiry.service.ts)
router.post(
  "/",
  asyncHandler(async (req: Request, res: Response) => {
    const data = await createBuyerEnquiryService(req.body);
    res.status(201).json(new ApiResponse(201, "Buyer enquiry submitted successfully", data));
  })
);

// Admin → Buyer Enquiries
router.get(
  "/admin",
  protect,
  asyncHandler(async (req: Request, res: Response) => {
    const data = await listBuyerEnquiriesService(req.query);
    res.status(200).json(new ApiResponse(200, "Buyer enquiries fetched successfully", data));
  })
);

router.put(
  "/admin/:id",
  protect,
  asyncHandler(async (req: Request, res: Response) => {
    const data = await updateBuyerEnquiryStatusService(idParam(req), req.body?.status);
    res.status(200).json(new ApiResponse(200, "Buyer enquiry updated successfully", data));
  })
);

router.delete(
  "/admin/:id",
  protect,
  asyncHandler(async (req: Request, res: Response) => {
    await deleteBuyerEnquiryService(idParam(req));
    res.status(200).json(new ApiResponse(200, "Buyer enquiry deleted successfully", null));
  })
);

export default router;
