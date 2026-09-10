import { Router } from "express";
import { getAboutHero, updateAboutHero } from "./aboutHero.controller";
import { createUploader } from "../../../../../middlewares/upload.middleware";

const router = Router();
const upload = createUploader("abouthero");

const uploadFields = upload.fields([
  { name: "image", maxCount: 1 },
  { name: "secondaryImage", maxCount: 1 },
]);

router.get("/", getAboutHero);
router.put("/", uploadFields, updateAboutHero);
router.post("/", uploadFields, updateAboutHero);

export default router;
