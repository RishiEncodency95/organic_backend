import { Router } from "express";
import { protect } from "../../middlewares/auth.middleware";
import { requirePermission } from "../../middlewares/permission.middleware";
import { getApiLimits, unblockIp, updateApiLimits } from "./apiLimits.controller";

const router = Router();

// The limit itself runs as apiBlockGuard (app.ts); these are the admin screens for it.
const canManage = [protect, requirePermission("perm_settings_manage", "perm_staff_view")];

router.get("/admin", ...canManage, getApiLimits);
router.put("/admin", ...canManage, updateApiLimits);
router.post("/admin/unblock", ...canManage, unblockIp);

export default router;
