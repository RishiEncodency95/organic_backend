import { Router } from "express";
import {
  getWhyVisitWhoShould,
  updateWhyVisitWhoShould,
  createWhyVisitWhoShould,
  getAllWhyVisitWhoShould,
  getWhyVisitWhoShouldById,
  updateWhyVisitWhoShouldById,
  deleteWhyVisitWhoShouldById,
} from "./whyVisitWhoShould.controller";

const router = Router();

router.get("/", getWhyVisitWhoShould);
router.put("/", updateWhyVisitWhoShould);
router.post("/", createWhyVisitWhoShould);
router.get("/all", getAllWhyVisitWhoShould);
router.get("/:id", getWhyVisitWhoShouldById);
router.put("/:id", updateWhyVisitWhoShouldById);
router.delete("/:id", deleteWhyVisitWhoShouldById);

export default router;
