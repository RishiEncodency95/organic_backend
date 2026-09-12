import { Router } from "express";
import { getMsmePmsBanner, updateMsmePmsBanner } from "./msmePmsBanner.controller";

const router = Router();

router.get("/", getMsmePmsBanner);
router.put("/", updateMsmePmsBanner);
router.post("/", updateMsmePmsBanner);

export default router;
