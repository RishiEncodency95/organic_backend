import { Router } from "express";
import { protect } from "../../middlewares/auth.middleware";
import {
  createBlogReport,
  deleteBlogReport,
  downloadBlogReport,
  getBlogReports,
  getPublicBlogReports,
  updateBlogReport,
} from "./blogReport.controller";

const router = Router();

router.get("/", getPublicBlogReports);
router.get("/admin", protect, getBlogReports);
router.get("/:id/download", downloadBlogReport);
router.post("/", protect, createBlogReport);
router.patch("/:id", protect, updateBlogReport);
router.put("/:id", protect, updateBlogReport);
router.delete("/:id", protect, deleteBlogReport);

export default router;
