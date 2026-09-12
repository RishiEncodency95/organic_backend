import { Router } from "express";
import {
  getMsmeOfficialRecognition,
  updateMsmeOfficialRecognition,
} from "./msmeOfficialRecognition.controller";

const router = Router();

router.get("/", getMsmeOfficialRecognition);
router.put("/", updateMsmeOfficialRecognition);
router.post("/", updateMsmeOfficialRecognition);

export default router;
