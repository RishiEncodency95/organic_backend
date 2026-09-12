import { Router } from "express";
import { getMsmeWhatsNext, updateMsmeWhatsNext } from "./msmeWhatsNext.controller";

const router = Router();

router.get("/", getMsmeWhatsNext);
router.put("/", updateMsmeWhatsNext);
router.post("/", updateMsmeWhatsNext);

export default router;
