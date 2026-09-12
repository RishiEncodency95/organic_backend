import { Router } from "express";
import {
  getExhibitorListHeader,
  updateExhibitorListHeader,
  createExhibitorListHeader,
  getAllExhibitorListHeader,
  getExhibitorListHeaderById,
  updateExhibitorListHeaderById,
  deleteExhibitorListHeaderById,
} from "./exhibitorListHeader.controller";

const router = Router();

router.get("/", getExhibitorListHeader);
router.put("/", updateExhibitorListHeader);
router.post("/", updateExhibitorListHeader);

router.get("/list", getAllExhibitorListHeader);
router.get("/:id", getExhibitorListHeaderById);
router.put("/:id", updateExhibitorListHeaderById);
router.delete("/:id", deleteExhibitorListHeaderById);

export default router;
