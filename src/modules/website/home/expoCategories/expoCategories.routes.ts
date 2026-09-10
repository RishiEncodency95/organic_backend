import { Router } from "express";
import { getExpoCategories, updateExpoCategories } from "./expoCategories.controller";
import { createUploader } from "../../../../middlewares/upload.middleware";

const router = Router();
const upload = createUploader("expocategory");

router.get("/", getExpoCategories);
router.put("/", upload.any(), updateExpoCategories);
router.post("/", upload.any(), updateExpoCategories);

export default router;
