import { Router } from "express";
import { getAboutFaq, updateAboutFaq } from "./aboutFaq.controller";

const router = Router();

router.get("/", getAboutFaq);
router.put("/", updateAboutFaq);
router.post("/", updateAboutFaq);

export default router;
