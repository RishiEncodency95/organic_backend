import { Router } from "express";
import { protect } from "../../middlewares/auth.middleware";
import { requirePermission } from "../../middlewares/permission.middleware";
import {
  getActiveEvents,
  getAvailableStalls,
  getEventRates,
  findRate,
  listEvents,
  createEvent,
  updateEvent,
  deleteEvent,
  listStalls,
  createStall,
  createStallsBulk,
  updateStall,
  deleteStall,
  listRates,
  upsertRate,
  deleteRate,
} from "./expo.controller";

const router = Router();

// Viewing needs stalls.view; any change needs stalls.allocate (super admins always pass).
const canView = [protect, requirePermission("perm_stalls_view", "perm_stalls_allocate")];
const canEdit = [protect, requirePermission("perm_stalls_allocate")];

// ---- Public: paths the Book a Stand page already calls ----
router.get("/events/active", getActiveEvents);
router.get("/stalls/available", getAvailableStalls);
router.get("/stall-rates/event/:eventId", getEventRates);
router.get("/stall-rates/find", findRate);

// ---- Admin ----
router.get("/events/admin", ...canView, listEvents);
router.post("/events/admin", ...canEdit, createEvent);
router.patch("/events/admin/:id", ...canEdit, updateEvent);
router.delete("/events/admin/:id", ...canEdit, deleteEvent);

router.get("/stalls/admin", ...canView, listStalls);
router.post("/stalls/admin", ...canEdit, createStall);
router.post("/stalls/admin/bulk", ...canEdit, createStallsBulk);
router.patch("/stalls/admin/:id", ...canEdit, updateStall);
router.delete("/stalls/admin/:id", ...canEdit, deleteStall);

router.get("/stall-rates/admin", ...canView, listRates);
router.put("/stall-rates/admin", ...canEdit, upsertRate);
router.delete("/stall-rates/admin/:id", ...canEdit, deleteRate);

export default router;
