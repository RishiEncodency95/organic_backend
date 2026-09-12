import { Router } from "express";
import whyExhibitRoutes from "./participate/why_exhibit/whyExhibit.routes";

const router = Router();

// Mount why_exhibit section routes under /participate/why-exhibit
router.use("/participate/why-exhibit", whyExhibitRoutes);

export default router;
