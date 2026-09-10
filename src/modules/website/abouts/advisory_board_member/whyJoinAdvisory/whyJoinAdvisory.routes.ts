import express from "express";
import {
  getWhyJoinAdvisory,
  updateWhyJoinAdvisory,
} from "./whyJoinAdvisory.controller";

const router = express.Router();

router.get("/", getWhyJoinAdvisory);
router.put("/", updateWhyJoinAdvisory);

export default router;
