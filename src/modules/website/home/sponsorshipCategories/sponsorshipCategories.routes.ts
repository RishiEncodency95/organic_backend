import { Router } from "express";
import {
  getSponsorshipCategories,
  updateSponsorshipCategories,
} from "./sponsorshipCategories.controller";
import { createUploader } from "../../../../middlewares/upload.middleware";

const router = Router();
const upload = createUploader("sponsorshipcat");

router.get("/", getSponsorshipCategories);
router.put("/", upload.fields([{ name: "image", maxCount: 1 }]), updateSponsorshipCategories);
router.post("/", upload.fields([{ name: "image", maxCount: 1 }]), updateSponsorshipCategories);

export default router;
