import { Router } from "express";
import whyVisitRoutes from "./participate/why_visit/whyVisit.routes";

const router = Router();

// Mount why_visit section routes under /participate/why-visit
router.use("/participate/why-visit", whyVisitRoutes);

export default router;
