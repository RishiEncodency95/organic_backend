import { Router } from "express";
import {
  getAwardsInfoColumns,
  updateAwardsInfoColumns,
} from "./awardsInfoColumns.controller";

const router = Router();

router.get("/", getAwardsInfoColumns);
router.put("/", updateAwardsInfoColumns);
router.post("/", updateAwardsInfoColumns);

export default router;
