import { Router } from "express";
import {
  getConferenceSeminars,
  updateConferenceSeminars,
} from "./conferenceSeminars.controller";
import { createUploader } from "../../../../middlewares/upload.middleware";

const router = Router();
const upload = createUploader("conferenceseminars");

router.get("/", getConferenceSeminars);
router.put("/", upload.fields([{ name: "image", maxCount: 1 }]), updateConferenceSeminars);
router.post("/", upload.fields([{ name: "image", maxCount: 1 }]), updateConferenceSeminars);

export default router;
