import { Router } from "express";
import { createUploader } from "../../../../../middlewares/upload.middleware";
import {
  getSponsorshipContact,
  updateSponsorshipContact,
  createSponsorshipContact,
  getAllSponsorshipContact,
  getSponsorshipContactById,
  updateSponsorshipContactById,
  deleteSponsorshipContactById,
} from "./sponsorshipContact.controller";

const router = Router();
const upload = createUploader("sponsorship-contact");

router.get("/", getSponsorshipContact);
router.put("/", upload.any(), updateSponsorshipContact);
router.post("/", upload.any(), createSponsorshipContact);
router.get("/all", getAllSponsorshipContact);
router.get("/:id", getSponsorshipContactById);
router.put("/:id", upload.any(), updateSponsorshipContactById);
router.delete("/:id", deleteSponsorshipContactById);

export default router;
