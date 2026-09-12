import { Router } from "express";
import { createUploader } from "../../../../../middlewares/upload.middleware";
import {
  getPartnershipWhy,
  updatePartnershipWhy,
  createPartnershipWhy,
  getAllPartnershipWhy,
  getPartnershipWhyById,
  updatePartnershipWhyById,
  deletePartnershipWhyById,
} from "./partnershipWhy.controller";

const router = Router();
const upload = createUploader("partnership-why");

router.get("/", getPartnershipWhy);
router.put("/", upload.any(), updatePartnershipWhy);
router.post("/", upload.any(), createPartnershipWhy);
router.get("/all", getAllPartnershipWhy);
router.get("/:id", getPartnershipWhyById);
router.put("/:id", upload.any(), updatePartnershipWhyById);
router.delete("/:id", deletePartnershipWhyById);

export default router;
