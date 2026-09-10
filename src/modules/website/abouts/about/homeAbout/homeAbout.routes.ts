import { Router } from "express";
import { getHomeAbout, updateHomeAbout } from "./homeAbout.controller";
import { createUploader } from "../../../../../middlewares/upload.middleware";

const router = Router();
const upload = createUploader("homeabout");

const uploadFields = upload.fields([
  { name: "image", maxCount: 1 },
  { name: "secondaryImage", maxCount: 1 },
]);

router.get("/", getHomeAbout);
router.put("/", uploadFields, updateHomeAbout);
router.post("/", uploadFields, updateHomeAbout);

export default router;
