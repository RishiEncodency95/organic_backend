import { NextFunction, Request, Response, Router } from "express";
import asyncHandler from "../../utils/asyncHandler";
import { ApiError } from "../../utils/ApiError";
import { ApiResponse } from "../../utils/ApiResponse";
import { protect } from "../../middlewares/auth.middleware";
import { requirePermission } from "../../middlewares/permission.middleware";
import { enquiryLimiter } from "../../middlewares/rateLimiter.middleware";
import { uploadPhotoMiddleware } from "../../middlewares/uploadPhoto.middleware";
import {
  createFeedbackService,
  deleteFeedbackService,
  listFeedbackService,
  updateFeedbackStatusService,
} from "./feedback.service";

const router = Router();

// Optional photo + logo (JPG / PNG / WEBP, 5 MB each); a wrong file is a 400, not a server error
const feedbackImages = (req: Request, res: Response, next: NextFunction) =>
  uploadPhotoMiddleware.fields([
    { name: "photo", maxCount: 1 },
    { name: "logo", maxCount: 1 },
  ])(req, res, (err: any) => {
    if (!err) return next();
    next(ApiError.badRequest(err.code === "LIMIT_FILE_SIZE" ? "Each image must be 5 MB or smaller." : err.message || "Invalid image."));
  });

// POST /api/feedback — website "Share Your Feedback" form
router.post(
  "/",
  enquiryLimiter,
  feedbackImages,
  asyncHandler(async (req: Request, res: Response) => {
    const files = (req.files || {}) as Record<string, Express.Multer.File[]>;
    const data = await createFeedbackService(req.body ?? {}, { photo: files.photo?.[0], logo: files.logo?.[0] });
    res.status(201).json(new ApiResponse(201, "Thank you! Your feedback has been received.", data));
  })
);

// Admin → Feedback (names and contact details: admins only)
const canView = [protect, requirePermission("perm_enquiries_view")];
const canEdit = [protect, requirePermission("perm_enquiries_reply")];

router.get(
  "/admin",
  ...canView,
  asyncHandler(async (_req: Request, res: Response) => {
    res.status(200).json(new ApiResponse(200, "Feedback fetched successfully", await listFeedbackService()));
  })
);

router.put(
  "/admin/:id",
  ...canEdit,
  asyncHandler(async (req: Request, res: Response) => {
    const data = await updateFeedbackStatusService(String(req.params.id), req.body?.status);
    res.status(200).json(new ApiResponse(200, "Feedback updated successfully", data));
  })
);

router.delete(
  "/admin/:id",
  ...canEdit,
  asyncHandler(async (req: Request, res: Response) => {
    await deleteFeedbackService(String(req.params.id));
    res.status(200).json(new ApiResponse(200, "Feedback deleted successfully", { deleted: true }));
  })
);

export default router;
