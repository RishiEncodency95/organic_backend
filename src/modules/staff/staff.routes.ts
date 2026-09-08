import { Router } from "express";
import {
  getStaffList,
  inviteStaff,
  updateStaff,
  updateStaffStatus,
} from "./staff.controller";
import { protect } from "../../middlewares/auth.middleware";

const router = Router();

router.use(protect);

router.get("/staff", getStaffList);
router.post("/staff", inviteStaff);
router.patch("/staff/:id", updateStaff);
router.patch("/staff/:id/status", updateStaffStatus);

export default router;
