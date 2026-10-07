import { Router } from "express";
import { getSettings, updateSettings, getPageStatuses, updatePageStatus } from "./settings.controller";
import { protect } from "../../middlewares/auth.middleware";

const router = Router();

// Pages & CMS → "Published" toggle. GET is public (the website reads it to hide
// unpublished pages from the navbar and 404 them); PATCH is admin-only.
router.get("/page-status", getPageStatuses);
router.patch("/page-status", protect, updatePageStatus);

router.get("/", getSettings);
router.put("/", updateSettings);
router.post("/", updateSettings);

export default router;
