import { Router } from "express";
import {
  getSponsorsAndAttend,
  updateSponsorsAndAttend,
} from "./sponsorsAndAttend.controller";
import { createUploader } from "../../../../middlewares/upload.middleware";

const router = Router();
const upload = createUploader("sponsorsattend");

router.get("/", getSponsorsAndAttend);
router.put("/", upload.fields([{ name: "image", maxCount: 1 }]), updateSponsorsAndAttend);
router.post("/", upload.fields([{ name: "image", maxCount: 1 }]), updateSponsorsAndAttend);

export default router;
