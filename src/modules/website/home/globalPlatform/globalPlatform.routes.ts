import { Router } from "express";
import {
  getGlobalPlatform,
  updateGlobalPlatform,
} from "./globalPlatform.controller";
import { createUploader } from "../../../../middlewares/upload.middleware";

const router = Router();
const upload = createUploader("globalplatform");

router.get("/", getGlobalPlatform);
router.put("/", upload.any(), updateGlobalPlatform);
router.post("/", upload.any(), updateGlobalPlatform);

export default router;
