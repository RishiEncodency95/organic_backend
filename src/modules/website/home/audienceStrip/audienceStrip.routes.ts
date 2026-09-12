import { Router } from "express";
import {
  getAudienceStrip,
  updateAudienceStrip,
} from "./audienceStrip.controller";

const router = Router();

router.get("/", getAudienceStrip);
router.put("/", updateAudienceStrip);
router.post("/", updateAudienceStrip);

export default router;
