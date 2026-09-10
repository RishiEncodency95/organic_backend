import { Router } from "express";
import {
  getAboutOrganizer,
  updateAboutOrganizer,
} from "./aboutOrganizer.controller";
import { createUploader } from "../../../../../middlewares/upload.middleware";

const router = Router();
const upload = createUploader("aboutorganizer");

const uploadFields = upload.fields([
  { name: "image", maxCount: 1 },
  { name: "logoImage", maxCount: 1 },
  { name: "secondaryImage", maxCount: 1 },
]);

router.get("/", getAboutOrganizer);
router.put("/", uploadFields, updateAboutOrganizer);
router.post("/", uploadFields, updateAboutOrganizer);

export default router;
