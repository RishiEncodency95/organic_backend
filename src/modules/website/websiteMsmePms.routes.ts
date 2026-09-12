import { Router } from "express";
import msmePmsRoutes from "./participate/msme_pms/msmePms.routes";

const router = Router();

// Mount MSME PMS section routes under /participate/msme
router.use("/participate/msme", msmePmsRoutes);

export default router;
