import { Router } from "express";
import {
  getMsmeOfficialMessage,
  updateMsmeOfficialMessage,
} from "./msmeOfficialMessage.controller";

const router = Router();

router.get("/", getMsmeOfficialMessage);
router.put("/", updateMsmeOfficialMessage);
router.post("/", updateMsmeOfficialMessage);

export default router;
