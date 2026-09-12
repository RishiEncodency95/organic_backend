import { Router } from "express";
import { getSettings, updateSettings } from "./settings.controller";

const router = Router();

router.get("/", getSettings);
router.put("/", updateSettings);
router.post("/", updateSettings);

export default router;
