import { Router } from "express";
import { getMsmeFinalCta, updateMsmeFinalCta } from "./msmeFinalCta.controller";

const router = Router();

router.get("/", getMsmeFinalCta);
router.put("/", updateMsmeFinalCta);
router.post("/", updateMsmeFinalCta);

export default router;
