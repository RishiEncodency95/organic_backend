import { Router } from "express";
import { getFourPillars, updateFourPillars } from "./fourPillars.controller";
import { createUploader } from "../../../../../middlewares/upload.middleware";

const router = Router();
const upload = createUploader("fourpillars");

router.get("/", getFourPillars);
router.put("/", upload.any(), updateFourPillars);
router.post("/", upload.any(), updateFourPillars);

export default router;
