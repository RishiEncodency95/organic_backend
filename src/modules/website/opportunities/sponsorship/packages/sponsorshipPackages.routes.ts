import { Router } from "express";
import { createUploader } from "../../../../../middlewares/upload.middleware";
import {
  getSponsorshipPackages,
  updateSponsorshipPackages,
  createSponsorshipPackages,
  getAllSponsorshipPackages,
  getSponsorshipPackagesById,
  updateSponsorshipPackagesById,
  deleteSponsorshipPackagesById,
} from "./sponsorshipPackages.controller";

const router = Router();
const upload = createUploader("sponsorship-packages");

router.get("/", getSponsorshipPackages);
router.put("/", upload.any(), updateSponsorshipPackages);
router.post("/", upload.any(), createSponsorshipPackages);
router.get("/all", getAllSponsorshipPackages);
router.get("/:id", getSponsorshipPackagesById);
router.put("/:id", upload.any(), updateSponsorshipPackagesById);
router.delete("/:id", deleteSponsorshipPackagesById);

export default router;
