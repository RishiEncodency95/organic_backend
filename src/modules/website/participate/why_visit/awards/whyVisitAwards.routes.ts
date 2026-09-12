import { Router } from "express";
import {
  getWhyVisitAwards,
  updateWhyVisitAwards,
  createWhyVisitAwards,
  getAllWhyVisitAwards,
  getWhyVisitAwardsById,
  updateWhyVisitAwardsById,
  deleteWhyVisitAwardsById,
} from "./whyVisitAwards.controller";

const router = Router();

router.get("/", getWhyVisitAwards);
router.put("/", updateWhyVisitAwards);
router.post("/", createWhyVisitAwards);
router.get("/all", getAllWhyVisitAwards);
router.get("/:id", getWhyVisitAwardsById);
router.put("/:id", updateWhyVisitAwardsById);
router.delete("/:id", deleteWhyVisitAwardsById);

export default router;
