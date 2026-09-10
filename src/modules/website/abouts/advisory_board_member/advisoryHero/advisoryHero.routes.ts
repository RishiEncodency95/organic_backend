import { Router } from "express";
import { getAdvisoryHero, updateAdvisoryHero } from "./advisoryHero.controller";
import { createUploader } from "../../../../../middlewares/upload.middleware";

const router = Router();
const upload = createUploader("advisoryhero");

const uploadFields = upload.fields([
  { name: "image", maxCount: 1 },
  { name: "secondaryImage", maxCount: 1 },
]);

router.get("/", getAdvisoryHero);
router.put("/", uploadFields, updateAdvisoryHero);
router.post("/", uploadFields, updateAdvisoryHero);

export default router;
