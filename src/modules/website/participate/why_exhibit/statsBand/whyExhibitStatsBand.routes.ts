import { Router } from "express";
import {
  getAllWhyExhibitStatsBand,
  createWhyExhibitStatsBand,
  getWhyExhibitStatsBandById,
  updateWhyExhibitStatsBandById,
  deleteWhyExhibitStatsBandById,
} from "./whyExhibitStatsBand.controller";

const router = Router();

router.get("/", getAllWhyExhibitStatsBand);
router.post("/", createWhyExhibitStatsBand);

router.get("/:id", getWhyExhibitStatsBandById);
router.put("/:id", updateWhyExhibitStatsBandById);
router.delete("/:id", deleteWhyExhibitStatsBandById);

export default router;
