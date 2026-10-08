import { Router } from "express";
import { protect } from "../../middlewares/auth.middleware";
import { requirePermission } from "../../middlewares/permission.middleware";
import { listActivityLogs } from "./activityLog.controller";

const router = Router();

// Read-only: the log is written by activityLog.middleware, never through the API.
// Seeing who did what is for staff / settings managers (super admins always pass).
router.get("/", protect, requirePermission("perm_settings_manage", "perm_staff_view"), listActivityLogs);

export default router;
