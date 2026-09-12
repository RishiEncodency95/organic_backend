import { Router } from "express";
import {
  getWhyVisitSupport,
  updateWhyVisitSupport,
  createWhyVisitSupport,
  getAllWhyVisitSupport,
  getWhyVisitSupportById,
  updateWhyVisitSupportById,
  deleteWhyVisitSupportById,
} from "./whyVisitSupport.controller";

const router = Router();

router.get("/", getWhyVisitSupport);
router.put("/", updateWhyVisitSupport);
router.post("/", createWhyVisitSupport);
router.get("/all", getAllWhyVisitSupport);
router.get("/:id", getWhyVisitSupportById);
router.put("/:id", updateWhyVisitSupportById);
router.delete("/:id", deleteWhyVisitSupportById);

export default router;
