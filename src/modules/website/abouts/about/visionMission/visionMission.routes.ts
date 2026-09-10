import { Router } from "express";
import { getVisionMission, updateVisionMission } from "./visionMission.controller";

const router = Router();

router.get("/", getVisionMission);
router.put("/", updateVisionMission);
router.post("/", updateVisionMission);

export default router;
