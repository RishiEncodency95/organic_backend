import { Router } from "express";
import { getAdvisoryBoardGrid, updateAdvisoryBoardGrid } from "./advisoryBoardGrid.controller";

const router = Router();

router.get("/", getAdvisoryBoardGrid);
router.put("/", updateAdvisoryBoardGrid);
router.post("/", updateAdvisoryBoardGrid);

export default router;
