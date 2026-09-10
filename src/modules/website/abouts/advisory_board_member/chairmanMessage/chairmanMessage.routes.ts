import { Router } from "express";
import { getChairmanMessage, updateChairmanMessage } from "./chairmanMessage.controller";

const router = Router();

router.get("/", getChairmanMessage);
router.put("/", updateChairmanMessage);
router.post("/", updateChairmanMessage);

export default router;
