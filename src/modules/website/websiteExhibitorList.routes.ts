import { Router } from "express";
import exhibitorListRoutes from "./participate/exhibitor_list/exhibitorList.routes";

const router = Router();

// Mount exhibitor_list routes under /participate/exhibitor-list
router.use("/participate/exhibitor-list", exhibitorListRoutes);

export default router;
