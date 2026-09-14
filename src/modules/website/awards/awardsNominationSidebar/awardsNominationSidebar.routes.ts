import { Router } from "express";
import {
  getNominationSidebar,
  updateNominationSidebar,
} from "./awardsNominationSidebar.controller";

const router = Router();

router.get("/", getNominationSidebar);
router.put("/", updateNominationSidebar);
router.post("/", updateNominationSidebar);

export default router;
