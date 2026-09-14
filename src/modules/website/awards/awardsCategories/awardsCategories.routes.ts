import { Router } from "express";
import {
  getAwardsCategories,
  updateAwardsCategories,
} from "./awardsCategories.controller";

const router = Router();

router.get("/", getAwardsCategories);
router.put("/", updateAwardsCategories);
router.post("/", updateAwardsCategories);

export default router;
