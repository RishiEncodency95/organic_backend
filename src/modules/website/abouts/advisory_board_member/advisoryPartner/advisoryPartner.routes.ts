import express from "express";
import {
  getAdvisoryPartner,
  updateAdvisoryPartner,
} from "./advisoryPartner.controller";

const router = express.Router();

router.get("/", getAdvisoryPartner);
router.put("/", updateAdvisoryPartner);

export default router;
