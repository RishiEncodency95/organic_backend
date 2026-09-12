import { Router } from "express";
import { getMsmeWhyParticipate, updateMsmeWhyParticipate } from "./msmeWhyParticipate.controller";

const router = Router();

router.get("/", getMsmeWhyParticipate);
router.put("/", updateMsmeWhyParticipate);
router.post("/", updateMsmeWhyParticipate);

export default router;
