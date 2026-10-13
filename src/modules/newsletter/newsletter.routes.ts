import { Request, Response, Router } from "express";
import asyncHandler from "../../utils/asyncHandler";
import { ApiResponse } from "../../utils/ApiResponse";
import { protect } from "../../middlewares/auth.middleware";
import { requirePermission } from "../../middlewares/permission.middleware";
import { newsletterLimiter } from "../../middlewares/rateLimiter.middleware";
import { deleteNewsletterSubscriberService, listNewsletterSubscribersService, subscribeNewsletterService } from "./newsletter.service";

const router = Router();

// POST /api/newsletter/subscribe — website "Subscribe" forms
router.post(
  "/subscribe",
  newsletterLimiter,
  asyncHandler(async (req: Request, res: Response) => {
    const { alreadySubscribed } = await subscribeNewsletterService(req.body ?? {});
    res
      .status(alreadySubscribed ? 200 : 201)
      .json(new ApiResponse(alreadySubscribed ? 200 : 201, alreadySubscribed ? "You are already subscribed. Thank you!" : "Thank you for subscribing!", { alreadySubscribed }));
  })
);

// Admin → Newsletter Subscribers (email addresses are personal data: admins only)
const canView = [protect, requirePermission("perm_enquiries_view")];
const canEdit = [protect, requirePermission("perm_enquiries_reply")];

router.get(
  "/admin",
  ...canView,
  asyncHandler(async (_req: Request, res: Response) => {
    res.status(200).json(new ApiResponse(200, "Newsletter subscribers", await listNewsletterSubscribersService()));
  })
);

router.delete(
  "/admin/:id",
  ...canEdit,
  asyncHandler(async (req: Request, res: Response) => {
    await deleteNewsletterSubscriberService(String(req.params.id));
    res.status(200).json(new ApiResponse(200, "Subscriber removed", { deleted: true }));
  })
);

export default router;
