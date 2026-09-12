import { Router } from "express";
import {
  getMsmeFinancialAssistance,
  updateMsmeFinancialAssistance,
} from "./msmeFinancialAssistance.controller";

const router = Router();

router.get("/", getMsmeFinancialAssistance);
router.put("/", updateMsmeFinancialAssistance);
router.post("/", updateMsmeFinancialAssistance);

export default router;
