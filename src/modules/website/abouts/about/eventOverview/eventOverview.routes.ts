import { Router } from "express";
import { getEventOverview, updateEventOverview } from "./eventOverview.controller";

const router = Router();

router.get("/", getEventOverview);
router.put("/", updateEventOverview);
router.post("/", updateEventOverview);

export default router;
