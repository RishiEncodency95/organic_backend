import { Router } from "express";
import { getMsmeFaq, updateMsmeFaq } from "./msmeFaq.controller";

const router = Router();

router.get("/", getMsmeFaq);
router.put("/", updateMsmeFaq);
router.post("/", updateMsmeFaq);

export default router;
