import { Router } from "express";
import { getHomeVideos, updateHomeVideos } from "./homeVideos.controller";
import { createUploader } from "../../../../middlewares/upload.middleware";

const router = Router();
const upload = createUploader("homevideo");

router.get("/", getHomeVideos);
router.put("/", upload.any(), updateHomeVideos);
router.post("/", upload.any(), updateHomeVideos);

export default router;
