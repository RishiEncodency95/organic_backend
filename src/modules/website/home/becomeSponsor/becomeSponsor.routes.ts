import { Router } from "express";
import { getBecomeSponsor, updateBecomeSponsor } from "./becomeSponsor.controller";
import { createUploader } from "../../../../middlewares/upload.middleware";

const router = Router();
const upload = createUploader("becomesponsor");

router.get("/", getBecomeSponsor);
router.put("/", upload.fields([{ name: "image", maxCount: 1 }]), updateBecomeSponsor);
router.post("/", upload.fields([{ name: "image", maxCount: 1 }]), updateBecomeSponsor);

export default router;
