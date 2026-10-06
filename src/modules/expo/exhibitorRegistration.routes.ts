import { Request, Response, Router } from "express";
import asyncHandler from "../../utils/asyncHandler";
import { ApiResponse } from "../../utils/ApiResponse";
import { protect } from "../../middlewares/auth.middleware";
import {
  createExhibitorOrderService,
  createExhibitorRegistrationService,
  deleteExhibitorRegistrationService,
  getExhibitorRegistrationService,
  listExhibitorRegistrationsService,
  updateExhibitorStatusService,
  verifyExhibitorPaymentService,
} from "./exhibitorRegistration.service";

const idParam = (req: Request) => String(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id);

/**
 * Website book-a-stand flow (the URLs BookAStandClient already calls):
 *   POST /exhibitor-registration            → save booking (before payment)
 *   POST /payment/create-order/:id           → Razorpay order for the server-calculated amount
 *   POST /payment/verify-payment             → verify signature, mark paid, book the stall
 */
export const exhibitorPublicRouter = Router();

exhibitorPublicRouter.post("/exhibitor-registration", asyncHandler(async (req: Request, res: Response) => {
  const data = await createExhibitorRegistrationService(req.body);
  res.status(201).json(new ApiResponse(201, "Registration saved", data));
}));

// These two answer in the flat shape the page reads ({ success, key, order } / { success }).
exhibitorPublicRouter.post("/payment/create-order/:id", asyncHandler(async (req: Request, res: Response) => {
  const { key, order } = await createExhibitorOrderService(idParam(req));
  res.status(200).json({ success: true, key, order });
}));

exhibitorPublicRouter.post("/payment/verify-payment", asyncHandler(async (req: Request, res: Response) => {
  const reg = await verifyExhibitorPaymentService(req.body);
  res.status(200).json({ success: true, message: "Payment verified", registrationNo: reg.registrationNo, stallConflict: reg.stallConflict });
}));

/** Admin → Exhibitors & Stand Bookings (Domestic / International). */
export const exhibitorAdminRouter = Router();

exhibitorAdminRouter.get("/admin", protect, asyncHandler(async (req: Request, res: Response) => {
  res.status(200).json(new ApiResponse(200, "Exhibitor registrations fetched", await listExhibitorRegistrationsService(req.query)));
}));
exhibitorAdminRouter.get("/admin/:id", protect, asyncHandler(async (req: Request, res: Response) => {
  res.status(200).json(new ApiResponse(200, "Exhibitor registration fetched", await getExhibitorRegistrationService(idParam(req))));
}));
exhibitorAdminRouter.put("/admin/:id", protect, asyncHandler(async (req: Request, res: Response) => {
  const by = String((req as any).user?.name || (req as any).user?.email || "Admin");
  res.status(200).json(new ApiResponse(200, "Status updated", await updateExhibitorStatusService(idParam(req), req.body?.status, by)));
}));
exhibitorAdminRouter.delete("/admin/:id", protect, asyncHandler(async (req: Request, res: Response) => {
  await deleteExhibitorRegistrationService(idParam(req));
  res.status(200).json(new ApiResponse(200, "Exhibitor registration deleted", null));
}));
