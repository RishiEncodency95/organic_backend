import { Router } from "express";
import {
  getWhyVisitMatters,
  updateWhyVisitMatters,
  createWhyVisitMatters,
  getAllWhyVisitMatters,
  getWhyVisitMattersById,
  updateWhyVisitMattersById,
  deleteWhyVisitMattersById,
} from "./whyVisitMatters.controller";

const router = Router();

router.get("/", getWhyVisitMatters);
router.put("/", updateWhyVisitMatters);
router.post("/", createWhyVisitMatters);
router.get("/all", getAllWhyVisitMatters);
router.get("/:id", getWhyVisitMattersById);
router.put("/:id", updateWhyVisitMattersById);
router.delete("/:id", deleteWhyVisitMattersById);

export default router;
