import { Router } from "express";
import { protect } from "../../middlewares/auth.middleware";
import { requirePermission } from "../../middlewares/permission.middleware";
import {
  getCountries,
  getStates,
  getCities,
  listCustomCities,
  createCustomCity,
  updateCustomCity,
  deleteCustomCity,
} from "./locations.controller";

const router = Router();

// Paths match what the website's registration forms already call.
router.get("/crm-countries", getCountries);
router.get("/crm-states", getStates);
router.get("/crm-cities", getCities);

// Admin: add cities the built-in data does not have.
const canView = [protect, requirePermission("perm_content_view", "perm_content_edit")];
const canEdit = [protect, requirePermission("perm_content_edit")];
router.get("/locations/admin/cities", ...canView, listCustomCities);
router.post("/locations/admin/cities", ...canEdit, createCustomCity);
router.patch("/locations/admin/cities/:id", ...canEdit, updateCustomCity);
router.delete("/locations/admin/cities/:id", ...canEdit, deleteCustomCity);

export default router;
