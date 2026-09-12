import { Router } from "express";
import { getMsmeSupportCover, updateMsmeSupportCover } from "./msmeSupportCover.controller";

const router = Router();

router.get("/", getMsmeSupportCover);
router.put("/", updateMsmeSupportCover);
router.post("/", updateMsmeSupportCover);

export default router;
