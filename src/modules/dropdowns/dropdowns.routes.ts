import { Router } from "express";
import { protect } from "../../middlewares/auth.middleware";
import { requirePermission } from "../../middlewares/permission.middleware";
import {
  getDropdowns,
  getDropdown,
  getAdminLists,
  getAdminOptions,
  createOption,
  updateOption,
  deleteOption,
  reorderOptions,
} from "./dropdowns.controller";

const router = Router();

// Admin routes come first so "/admin" is never read as a list key.
// Viewing needs content.view; changing options needs content.edit (super admins always pass).
const canView = [protect, requirePermission("perm_content_view", "perm_content_edit")];
const canEdit = [protect, requirePermission("perm_content_edit")];

router.get("/admin/lists", ...canView, getAdminLists);
router.get("/admin/options", ...canView, getAdminOptions);
router.put("/admin/lists/:list/order", ...canEdit, reorderOptions);
router.post("/admin/options", ...canEdit, createOption);
router.patch("/admin/options/:id", ...canEdit, updateOption);
router.delete("/admin/options/:id", ...canEdit, deleteOption);

// Public: what the website forms read.
router.get("/", getDropdowns);
router.get("/:list", getDropdown);

export default router;
