import { Router } from "express";
import { getMsmeFeatureStrip, updateMsmeFeatureStrip } from "./msmeFeatureStrip.controller";

const router = Router();

router.get("/", getMsmeFeatureStrip);
router.put("/", updateMsmeFeatureStrip);
router.post("/", updateMsmeFeatureStrip);

export default router;
