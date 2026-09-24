import { Router } from "express";
import { seoController } from "./seo.controller";

const router = Router();

// Auto-generation route
router.post("/generate", seoController.generate);

// Recommendation routes (Gemini AI Fixes)
router.post("/recommendations/pages/:id", seoController.generatePageRecommendations);
router.post("/recommendations/site", seoController.generateSiteRecommendations);

// General list & create
router.get("/pages", seoController.getSeoPages);
router.get("/", seoController.getAllSeo);
router.post("/create", seoController.upsertSeo);
router.put("/update/:id", seoController.upsertSeo);

// Page specific routes (e.g. /api/seo/home or /api/seo/about/advisory_board_member)
const handlePageParam = (handler: Function) => (req: any, res: any) => {
  const p = (req.params as any).page || (req.params as any)[0] || req.path.replace(/^\/+/, "");
  req.params.page = Array.isArray(p) ? p.join("/") : p;
  return handler(req, res);
};

router.get("/{*page}", handlePageParam(seoController.getSeoByPage));
router.put("/{*page}", handlePageParam(seoController.upsertSeo));
router.post("/{*page}", handlePageParam(seoController.upsertSeo));

export default router;
