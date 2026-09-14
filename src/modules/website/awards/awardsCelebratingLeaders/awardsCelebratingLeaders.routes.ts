import { Router } from "express";
import {
  getAwardsCelebratingLeaders,
  updateAwardsCelebratingLeaders,
} from "./awardsCelebratingLeaders.controller";

const router = Router();

router.get("/", getAwardsCelebratingLeaders);
router.put("/", updateAwardsCelebratingLeaders);
router.post("/", updateAwardsCelebratingLeaders);

export default router;
