import { Router } from "express";
import { getMsmeNeedHelp, updateMsmeNeedHelp } from "./msmeNeedHelp.controller";

const router = Router();

router.get("/", getMsmeNeedHelp);
router.put("/", updateMsmeNeedHelp);
router.post("/", updateMsmeNeedHelp);

export default router;
