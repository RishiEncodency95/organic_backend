import { Router } from "express";
import {
  getAllExhibitorItems,
  createExhibitorItem,
  getExhibitorItemById,
  updateExhibitorItemById,
  deleteExhibitorItemById,
} from "./exhibitorItem.controller";
import { createUploader } from "../../../../../middlewares/upload.middleware";

const router = Router();
const upload = createUploader("exhibitorlistitems");

const uploadFields = upload.fields([{ name: "image", maxCount: 1 }]);

router.get("/", getAllExhibitorItems);
router.post("/", uploadFields, createExhibitorItem);

router.get("/:id", getExhibitorItemById);
router.put("/:id", uploadFields, updateExhibitorItemById);
router.delete("/:id", deleteExhibitorItemById);

export default router;
