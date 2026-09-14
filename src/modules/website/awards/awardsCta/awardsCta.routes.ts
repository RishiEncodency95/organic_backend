import { Router } from "express";
import { getAwardsCta, updateAwardsCta } from "./awardsCta.controller";

const router = Router();

router.get("/", getAwardsCta);
router.put("/", updateAwardsCta);
router.post("/", updateAwardsCta);

export default router;
