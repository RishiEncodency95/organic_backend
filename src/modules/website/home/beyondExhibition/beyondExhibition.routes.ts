import { Router } from "express";
import {
  getBeyondExhibition,
  updateBeyondExhibition,
} from "./beyondExhibition.controller";
import { createUploader } from "../../../../middlewares/upload.middleware";

const router = Router();
const upload = createUploader("beyondexhibition");

router.get("/", getBeyondExhibition);
router.put("/", upload.fields([{ name: "image", maxCount: 1 }]), updateBeyondExhibition);
router.post("/", upload.fields([{ name: "image", maxCount: 1 }]), updateBeyondExhibition);

export default router;
