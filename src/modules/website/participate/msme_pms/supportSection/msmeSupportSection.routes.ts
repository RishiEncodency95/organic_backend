import { Router } from "express";
import { getMsmeSupportSection, updateMsmeSupportSection } from "./msmeSupportSection.controller";

const router = Router();

router.get("/", getMsmeSupportSection);
router.put("/", updateMsmeSupportSection);
router.post("/", updateMsmeSupportSection);

export default router;
