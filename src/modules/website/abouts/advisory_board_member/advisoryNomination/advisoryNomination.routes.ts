import { Router } from "express";
import { protect } from "../../../../../middlewares/auth.middleware";
import { requirePermission } from "../../../../../middlewares/permission.middleware";
import { nominationLimiter } from "../../../../../middlewares/rateLimiter.middleware";
import {
  deleteAdvisoryNomination,
  getAdvisoryNomination,
  listAdvisoryNominations,
  submitAdvisoryNomination,
  updateAdvisoryNomination,
} from "./advisoryNomination.controller";

const router = Router();

// Public: the website form
router.post("/", nominationLimiter, submitAdvisoryNomination);

// Admin only: nominations carry people's contact details
const canView = [protect, requirePermission("perm_enquiries_view")];
const canEdit = [protect, requirePermission("perm_enquiries_reply")];
router.get("/", ...canView, listAdvisoryNominations);
router.get("/:id", ...canView, getAdvisoryNomination);
router.patch("/:id", ...canEdit, updateAdvisoryNomination);
router.delete("/:id", ...canEdit, deleteAdvisoryNomination);

export default router;
