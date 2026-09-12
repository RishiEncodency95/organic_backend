import { Router } from "express";
import { createUploader } from "../../../../../middlewares/upload.middleware";
import {
  getSponsorshipWhy,
  updateSponsorshipWhy,
  createSponsorshipWhy,
  getAllSponsorshipWhy,
  getSponsorshipWhyById,
  updateSponsorshipWhyById,
  deleteSponsorshipWhyById,
} from "./sponsorshipWhy.controller";

const router = Router();
const upload = createUploader("sponsorship-why");

router.get("/", getSponsorshipWhy);
router.put("/", upload.any(), updateSponsorshipWhy);
router.post("/", upload.any(), createSponsorshipWhy);
router.get("/all", getAllSponsorshipWhy);
router.get("/:id", getSponsorshipWhyById);
router.put("/:id", upload.any(), updateSponsorshipWhyById);
router.delete("/:id", deleteSponsorshipWhyById);

export default router;
