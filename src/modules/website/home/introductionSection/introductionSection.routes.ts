import { Router } from "express";
import {
  getIntroductionSection,
  updateIntroductionSection,
} from "./introductionSection.controller";
import { createUploader } from "../../../../middlewares/upload.middleware";

const router = Router();
const upload = createUploader("introsection");

router.get("/", getIntroductionSection);
router.put("/", upload.fields([{ name: "image", maxCount: 1 }]), updateIntroductionSection);
router.post("/", upload.fields([{ name: "image", maxCount: 1 }]), updateIntroductionSection);

export default router;
