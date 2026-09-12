import { Router } from "express";
import {
  getWhyVisitSegments,
  updateWhyVisitSegments,
  createWhyVisitSegments,
  getAllWhyVisitSegments,
  getWhyVisitSegmentsById,
  updateWhyVisitSegmentsById,
  deleteWhyVisitSegmentsById,
} from "./whyVisitSegments.controller";

const router = Router();

router.get("/", getWhyVisitSegments);
router.put("/", updateWhyVisitSegments);
router.post("/", createWhyVisitSegments);
router.get("/all", getAllWhyVisitSegments);
router.get("/:id", getWhyVisitSegmentsById);
router.put("/:id", updateWhyVisitSegmentsById);
router.delete("/:id", deleteWhyVisitSegmentsById);

export default router;
