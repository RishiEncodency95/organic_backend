import { Router } from "express";
import {
  getSponsorsAndAttend,
  updateSponsorsAndAttend,
} from "./sponsorsAndAttend.controller";

const router = Router();

router.get("/", getSponsorsAndAttend);
router.put("/", updateSponsorsAndAttend);
router.post("/", updateSponsorsAndAttend);

export default router;
