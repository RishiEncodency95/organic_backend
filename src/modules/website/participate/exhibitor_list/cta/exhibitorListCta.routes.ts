import { Router } from "express";
import {
  getExhibitorListCta,
  updateExhibitorListCta,
  createExhibitorListCta,
  getAllExhibitorListCta,
  getExhibitorListCtaById,
  updateExhibitorListCtaById,
  deleteExhibitorListCtaById,
} from "./exhibitorListCta.controller";
import { createUploader } from "../../../../../middlewares/upload.middleware";

const router = Router();
const upload = createUploader("exhibitorlistcta");

const uploadFields = upload.fields([
  { name: "beImg", maxCount: 1 },
  { name: "leafImg", maxCount: 1 },
]);

router.get("/", getExhibitorListCta);
router.put("/", uploadFields, updateExhibitorListCta);
router.post("/", uploadFields, updateExhibitorListCta);

router.get("/list", getAllExhibitorListCta);
router.get("/:id", getExhibitorListCtaById);
router.put("/:id", uploadFields, updateExhibitorListCtaById);
router.delete("/:id", deleteExhibitorListCtaById);

export default router;
