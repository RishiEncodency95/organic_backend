import { Router } from "express";
import { createUploader } from "../../../../../middlewares/upload.middleware";
import {
  getSponsorshipBottom,
  updateSponsorshipBottom,
  createSponsorshipBottom,
  getAllSponsorshipBottom,
  getSponsorshipBottomById,
  updateSponsorshipBottomById,
  deleteSponsorshipBottomById,
} from "./sponsorshipBottom.controller";

const router = Router();
const upload = createUploader("sponsorship-bottom");

router.get("/", getSponsorshipBottom);
router.put("/", upload.any(), updateSponsorshipBottom);
router.post("/", upload.any(), createSponsorshipBottom);
router.get("/all", getAllSponsorshipBottom);
router.get("/:id", getSponsorshipBottomById);
router.put("/:id", upload.any(), updateSponsorshipBottomById);
router.delete("/:id", deleteSponsorshipBottomById);

export default router;
