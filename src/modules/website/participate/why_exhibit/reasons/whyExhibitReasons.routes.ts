import { Router } from "express";
import {
  getAllWhyExhibitReasons,
  createWhyExhibitReasons,
  getWhyExhibitReasonsById,
  updateWhyExhibitReasonsById,
  deleteWhyExhibitReasonsById,
} from "./whyExhibitReasons.controller";
import { createUploader } from "../../../../../middlewares/upload.middleware";

const router = Router();
const upload = createUploader("whyexhibitreasons");

const uploadFields = upload.fields([{ name: "img", maxCount: 1 }]);

router.get("/", getAllWhyExhibitReasons);
router.post("/", uploadFields, createWhyExhibitReasons);

router.get("/:id", getWhyExhibitReasonsById);
router.put("/:id", uploadFields, updateWhyExhibitReasonsById);
router.delete("/:id", deleteWhyExhibitReasonsById);

export default router;
