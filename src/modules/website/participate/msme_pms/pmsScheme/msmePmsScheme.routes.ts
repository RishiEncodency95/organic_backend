import { Router } from "express";
import { getMsmePmsScheme, updateMsmePmsScheme } from "./msmePmsScheme.controller";

const router = Router();

router.get("/", getMsmePmsScheme);
router.put("/", updateMsmePmsScheme);
router.post("/", updateMsmePmsScheme);

export default router;
