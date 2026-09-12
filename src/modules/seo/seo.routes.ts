import { Router } from "express";
import { seoController } from "./seo.controller";

const router = Router();

// Auto-generation route
router.post("/generate", seoController.generate);

// General list & create
router.get("/", seoController.getAllSeo);
router.post("/create", seoController.upsertSeo);
router.put("/update/:id", seoController.upsertSeo);

// Page specific routes (e.g. /api/seo/home or /api/seo/about)
router.get("/:page", seoController.getSeoByPage);
router.put("/:page", seoController.upsertSeo);
router.post("/:page", seoController.upsertSeo);

export default router;
