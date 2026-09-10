import { Router } from "express";
import { getAboutStrip, updateAboutStrip } from "./aboutStrip.controller";

const router = Router();

router.get("/", getAboutStrip);
router.put("/", updateAboutStrip);
router.post("/", updateAboutStrip);

export default router;
