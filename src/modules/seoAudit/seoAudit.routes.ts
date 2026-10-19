import { Router } from "express";
import { seoAuditController } from "./seoAudit.controller";

const router = Router();

// Real SEO audit: live crawl + TLS/DNS/header probes + PageSpeed + Search Console + LLM probes
router.post("/run", seoAuditController.runAudit);
router.get("/report", seoAuditController.getReport);
router.get("/routes", seoAuditController.getRoutes);
router.get("/pages", seoAuditController.getPages);
router.get("/pages/:id", seoAuditController.getPageDetail);
router.get("/overview", seoAuditController.getOverview);

export default router;
