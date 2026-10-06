import { Request, Response, Router } from "express";
import asyncHandler from "../../../utils/asyncHandler";
import { ApiResponse } from "../../../utils/ApiResponse";
import { protect } from "../../../middlewares/auth.middleware";
import {
  createGroupVisitorService,
  createSingleVisitorService,
  deleteVisitorRegistrationService,
  getVisitorRegistrationService,
  listVisitorRegistrationsService,
  updateVisitorStatusService,
} from "./visitorRegistration.service";

const created = (res: Response, data: any) =>
  res.status(201).json(new ApiResponse(201, `Registration successful. Your registration number is ${data.registrationNo}.`, data));

/**
 * Website submits — these are the URLs the visitor registration forms already post to
 * (frontend lib/api.ts → visitorApi).
 */
export const visitorPublicRouter = Router();

visitorPublicRouter.post("/corporate-visitors", asyncHandler(async (req: Request, res: Response) => {
  created(res, await createSingleVisitorService("domestic", "corporate", req.body));
}));
visitorPublicRouter.post("/general-visitors", asyncHandler(async (req: Request, res: Response) => {
  created(res, await createSingleVisitorService("domestic", "general", req.body));
}));
visitorPublicRouter.post("/health-camp-visitors", asyncHandler(async (req: Request, res: Response) => {
  created(res, await createSingleVisitorService("domestic", "healthCamp", req.body));
}));
visitorPublicRouter.post("/international-visitors", asyncHandler(async (req: Request, res: Response) => {
  created(res, await createSingleVisitorService("international", "", req.body));
}));
visitorPublicRouter.post("/group-visitors", asyncHandler(async (req: Request, res: Response) => {
  created(res, await createGroupVisitorService(req.body));
}));

/** Admin → Visitor Registrations (Domestic / International / Group). */
export const visitorAdminRouter = Router();
const idParam = (req: Request) => String(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id);

visitorAdminRouter.get("/admin", protect, asyncHandler(async (req: Request, res: Response) => {
  res.status(200).json(new ApiResponse(200, "Visitor registrations fetched", await listVisitorRegistrationsService(req.query)));
}));
visitorAdminRouter.get("/admin/:id", protect, asyncHandler(async (req: Request, res: Response) => {
  res.status(200).json(new ApiResponse(200, "Visitor registration fetched", await getVisitorRegistrationService(idParam(req))));
}));
visitorAdminRouter.put("/admin/:id", protect, asyncHandler(async (req: Request, res: Response) => {
  const by = String((req as any).user?.name || (req as any).user?.email || "Admin");
  res.status(200).json(new ApiResponse(200, "Status updated", await updateVisitorStatusService(idParam(req), req.body?.status, by)));
}));
visitorAdminRouter.delete("/admin/:id", protect, asyncHandler(async (req: Request, res: Response) => {
  await deleteVisitorRegistrationService(idParam(req));
  res.status(200).json(new ApiResponse(200, "Visitor registration deleted", null));
}));
